-- Registrar e desfazer hábitos, concedendo XP com idempotência.
-- As chaves seguem packages/domain/src/xp.ts:
--   habit-log:<log_id>
--   perfect-day:<user_id>:<data>:<ocorrência>
--   reversal:<chave original>

-- Data local de hoje no fuso do usuário.
create or replace function public.user_today(p_user_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone p.timezone)::date
  from public.profiles p
  where p.id = p_user_id;
$$;

-- Soma de XP do usuário logado.
create or replace function public.my_total_xp()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.xp_transactions
  where user_id = (select auth.uid());
$$;

-- Hábitos agendados numa data que ainda não têm registro.
create or replace function public.pending_scheduled_count(p_user_id uuid, p_date date)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.habits h
  where h.user_id = p_user_id
    and p_date >= h.start_date
    and (h.archived_on is null or p_date <= h.archived_on)
    and extract(dow from p_date)::smallint = any (h.schedule_days)
    and not exists (
      select 1 from public.habit_logs l
      where l.habit_id = h.id and l.local_date = p_date
    );
$$;

-- Saldo líquido do bônus de dia perfeito numa data (> 0 = bônus ativo).
create or replace function public.perfect_day_net(p_user_id uuid, p_date date)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.xp_transactions
  where user_id = p_user_id
    and local_date = p_date
    and (
      source_type = 'perfect_day'
      or (source_type = 'reversal' and idempotency_key like 'reversal:perfect-day:%')
    );
$$;

-- ─────────────────────────────────────────────────────────────
-- log_habit: registra a conclusão de um hábito (hoje ou ontem).
-- Chamar duas vezes para a mesma ocorrência não concede XP duas vezes.
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_habit(
  p_habit_id uuid,
  p_local_date date,
  p_qty numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_habit public.habits%rowtype;
  v_log_id uuid;
  v_xp integer := 0;
  v_bonus integer := 0;
  v_occurrence integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_habit from public.habits where id = p_habit_id and user_id = v_user;
  if not found then
    raise exception 'Hábito não encontrado' using errcode = 'P0002';
  end if;

  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível registrar hoje ou ontem' using errcode = '22023';
  end if;

  if p_local_date < v_habit.start_date
     or (v_habit.archived_on is not null and p_local_date > v_habit.archived_on)
     or not (extract(dow from p_local_date)::smallint = any (v_habit.schedule_days)) then
    raise exception 'Hábito não agendado para esta data' using errcode = '22023';
  end if;

  -- Serializa registros do mesmo usuário no mesmo dia (bônus de dia perfeito).
  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  insert into public.habit_logs (user_id, habit_id, local_date, qty)
  values (v_user, p_habit_id, p_local_date, p_qty)
  on conflict (habit_id, local_date) do nothing
  returning id into v_log_id;

  if v_log_id is not null then
    select amount into v_xp from public.xp_rules where key = 'habit_' || v_habit.difficulty::text;

    insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
    values (v_user, v_xp, 'habit', v_log_id, p_local_date, 'habit-log:' || v_log_id::text);

    if public.pending_scheduled_count(v_user, p_local_date) = 0
       and public.perfect_day_net(v_user, p_local_date) = 0 then
      select amount into v_bonus from public.xp_rules where key = 'perfect_day_bonus';
      if v_bonus > 0 then
        select count(*) + 1 into v_occurrence
        from public.xp_transactions
        where user_id = v_user and local_date = p_local_date and source_type = 'perfect_day';

        insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (
          v_user, v_bonus, 'perfect_day', p_local_date,
          'perfect-day:' || v_user::text || ':' || p_local_date::text || ':' || v_occurrence::text
        );
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'logged', v_log_id is not null,
    'xp_awarded', v_xp,
    'perfect_day_bonus', v_bonus,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- undo_habit_log: desfaz o registro (hoje ou ontem) e estorna o XP.
-- ─────────────────────────────────────────────────────────────
create or replace function public.undo_habit_log(p_habit_id uuid, p_local_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_log_id uuid;
  v_original public.xp_transactions%rowtype;
  v_bonus public.xp_transactions%rowtype;
  v_reverted integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível desfazer hoje ou ontem' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  delete from public.habit_logs
  where habit_id = p_habit_id and local_date = p_local_date and user_id = v_user
  returning id into v_log_id;

  if v_log_id is not null then
    select * into v_original
    from public.xp_transactions
    where idempotency_key = 'habit-log:' || v_log_id::text;

    if found then
      insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
      values (v_user, -v_original.amount, 'reversal', v_log_id, p_local_date, 'reversal:' || v_original.idempotency_key)
      on conflict (idempotency_key) do nothing;
      v_reverted := v_original.amount;
    end if;

    -- O dia deixou de ser perfeito: estorna o bônus ativo.
    if public.perfect_day_net(v_user, p_local_date) > 0 then
      select * into v_bonus
      from public.xp_transactions t
      where t.user_id = v_user and t.local_date = p_local_date and t.source_type = 'perfect_day'
        and not exists (
          select 1 from public.xp_transactions r
          where r.idempotency_key = 'reversal:' || t.idempotency_key
        )
      limit 1;

      insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
      values (v_user, -v_bonus.amount, 'reversal', p_local_date, 'reversal:' || v_bonus.idempotency_key)
      on conflict (idempotency_key) do nothing;
      v_reverted := v_reverted + v_bonus.amount;
    end if;
  end if;

  return jsonb_build_object(
    'undone', v_log_id is not null,
    'xp_reverted', v_reverted,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user)
  );
end;
$$;

-- Só usuários logados chamam as funções; as auxiliares ficam internas.
revoke execute on function public.log_habit(uuid, date, numeric) from public, anon;
revoke execute on function public.undo_habit_log(uuid, date) from public, anon;
revoke execute on function public.my_total_xp() from public, anon;
revoke execute on function public.user_today(uuid) from public, anon, authenticated;
revoke execute on function public.pending_scheduled_count(uuid, date) from public, anon, authenticated;
revoke execute on function public.perfect_day_net(uuid, date) from public, anon, authenticated;

grant execute on function public.log_habit(uuid, date, numeric) to authenticated;
grant execute on function public.undo_habit_log(uuid, date) to authenticated;
grant execute on function public.my_total_xp() to authenticated;
