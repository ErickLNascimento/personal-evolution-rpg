-- Títulos: escolher o título exibido e conquistar títulos especiais.
-- Como XP e Cristais, títulos especiais são concedidos SÓ por funções do banco
-- (log_habit → grant_titles, e complete_objective). O app só escolhe qual exibir.

-- ─────────────────────────────────────────────────────────────
-- Catálogo (nomes e textos ficam no domínio; aqui, identidade e regras)
-- ─────────────────────────────────────────────────────────────
create table public.title_catalog (
  id text primary key,
  kind text not null check (kind in ('level', 'achievement', 'secret', 'objective')),
  rarity text not null check (rarity in ('comum', 'raro', 'epico', 'lendario')),
  min_level integer check (min_level is null or min_level >= 1),
  category text check (category in (
    'health', 'career', 'finance', 'knowledge', 'productivity',
    'relationships', 'wellbeing', 'personal_growth'
  ))
);

insert into public.title_catalog (id, kind, rarity, min_level, category) values
  ('nivel-1', 'level', 'comum', 1, null),
  ('nivel-5', 'level', 'comum', 5, null),
  ('nivel-10', 'level', 'raro', 10, null),
  ('nivel-15', 'level', 'raro', 15, null),
  ('nivel-20', 'level', 'epico', 20, null),
  ('nivel-30', 'level', 'lendario', 30, null),
  ('primeiro-passo', 'achievement', 'comum', null, null),
  ('centuriao', 'achievement', 'raro', null, null),
  ('mestre-das-manhas', 'achievement', 'raro', null, null),
  ('lorde-dos-cristais', 'achievement', 'raro', null, null),
  ('inabalavel', 'achievement', 'epico', null, null),
  ('fenix', 'secret', 'epico', null, null),
  ('equilibrio-perfeito', 'secret', 'lendario', null, null),
  ('conquista-health', 'objective', 'epico', null, 'health'),
  ('conquista-career', 'objective', 'epico', null, 'career'),
  ('conquista-finance', 'objective', 'epico', null, 'finance'),
  ('conquista-knowledge', 'objective', 'epico', null, 'knowledge'),
  ('conquista-productivity', 'objective', 'epico', null, 'productivity'),
  ('conquista-relationships', 'objective', 'epico', null, 'relationships'),
  ('conquista-wellbeing', 'objective', 'epico', null, 'wellbeing'),
  ('conquista-personal_growth', 'objective', 'epico', null, 'personal_growth');

create table public.user_titles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  title_id text not null references public.title_catalog (id),
  earned_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

alter table public.profiles add column equipped_title text references public.title_catalog (id);

alter table public.title_catalog enable row level security;
alter table public.user_titles enable row level security;
create policy "title_catalog: leitura" on public.title_catalog for select to authenticated using (true);
create policy "user_titles: ler o próprio" on public.user_titles
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.title_catalog, public.user_titles from anon, authenticated;
grant select on public.title_catalog, public.user_titles to authenticated;

-- Recompensa em Cristais por conquistar um objetivo.
alter table public.coin_transactions drop constraint coin_transactions_source_type_check;
alter table public.coin_transactions add constraint coin_transactions_source_type_check
  check (source_type in ('habit', 'perfect_day', 'level_up', 'purchase', 'reversal', 'achievement'));
insert into public.coin_rules (key, amount) values ('coin_objective_done', 100);

-- ─────────────────────────────────────────────────────────────
-- Só se exibe um título que o usuário tem (o perfil é editável pelo próprio usuário).
-- ─────────────────────────────────────────────────────────────
create or replace function public.profiles_guard_equipped_title()
returns trigger
language plpgsql
security definer -- só lê; precisa de level_from_xp, que é interna
set search_path = ''
as $$
declare
  v_title public.title_catalog%rowtype;
  v_level integer;
begin
  if new.equipped_title is null or new.equipped_title is not distinct from old.equipped_title then
    return new;
  end if;
  select * into v_title from public.title_catalog where id = new.equipped_title;
  if v_title.kind = 'level' then
    v_level := public.level_from_xp(
      (select coalesce(sum(amount), 0)::integer from public.xp_transactions where user_id = new.id));
    if v_level >= v_title.min_level then
      return new;
    end if;
  elsif exists (select 1 from public.user_titles where user_id = new.id and title_id = new.equipped_title) then
    return new;
  end if;
  raise exception 'Título ainda não conquistado: %', new.equipped_title using errcode = 'PR007';
end;
$$;

create trigger profiles_guard_equipped_title before update of equipped_title on public.profiles
  for each row execute function public.profiles_guard_equipped_title();

-- ─────────────────────────────────────────────────────────────
-- grant_titles: confere as conquistas depois de um registro e concede as novas.
-- Chamada por log_habit. Devolve os ids concedidos agora.
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_titles(p_user_id uuid, p_local_date date, p_perfect_now boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_candidates text[] := '{}';
  v_granted text[];
  v_logs integer;
  v_previous date;
begin
  select timezone into v_tz from public.profiles where id = p_user_id;
  select count(*) into v_logs from public.habit_logs where user_id = p_user_id;

  if v_logs >= 1 then v_candidates := array_append(v_candidates, 'primeiro-passo'); end if;
  if v_logs >= 100 then v_candidates := array_append(v_candidates, 'centuriao'); end if;

  -- 10 missões concluídas antes das 8h, no próprio dia (fuso do usuário)
  if (select count(*) from public.habit_logs l
      where l.user_id = p_user_id
        and (l.created_at at time zone v_tz)::date = l.local_date
        and extract(hour from l.created_at at time zone v_tz) < 8) >= 10 then
    v_candidates := array_append(v_candidates, 'mestre-das-manhas');
  end if;

  -- 1.000 Cristais ganhos no total (compras não descontam; estornos sim)
  if (select coalesce(sum(amount), 0) from public.coin_transactions
      where user_id = p_user_id and source_type <> 'purchase') >= 1000 then
    v_candidates := array_append(v_candidates, 'lorde-dos-cristais');
  end if;

  -- 30 dias perfeitos (bônus de dia perfeito ativo na data)
  if (select count(*) from (
        select local_date from public.xp_transactions
        where user_id = p_user_id
          and (source_type = 'perfect_day' or (source_type = 'reversal' and idempotency_key like 'reversal:perfect-day:%'))
        group by local_date having sum(amount) > 0) d) >= 30 then
    v_candidates := array_append(v_candidates, 'inabalavel');
  end if;

  if p_perfect_now then
    -- Fênix (secreto): dia perfeito depois de 7 dias ou mais sem nenhum registro
    select max(local_date) into v_previous from public.habit_logs
    where user_id = p_user_id and local_date < p_local_date;
    if v_previous is not null and v_previous <= p_local_date - 8 then
      v_candidates := array_append(v_candidates, 'fenix');
    end if;

    -- Equilíbrio perfeito (secreto): dia perfeito com missões de 4 áreas diferentes
    if (select count(distinct coalesce(o.category, 'personal_growth'))
        from public.habit_logs l
        join public.habits h on h.id = l.habit_id
        left join public.objectives o on o.id = h.objective_id
        where l.user_id = p_user_id and l.local_date = p_local_date) >= 4 then
      v_candidates := array_append(v_candidates, 'equilibrio-perfeito');
    end if;
  end if;

  with ins as (
    insert into public.user_titles (user_id, title_id)
    select p_user_id, t from unnest(v_candidates) t
    on conflict do nothing
    returning title_id
  )
  select coalesce(array_agg(title_id), '{}') into v_granted from ins;
  return v_granted;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- log_habit: igual ao anterior; no fim, confere títulos e devolve os novos.
-- (Reescrita completa: só o bloco de títulos e o campo titles_granted são novos.)
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
  v_tz text;
  v_habit public.habits%rowtype;
  v_class public.class_catalog%rowtype;
  v_log_id uuid;
  v_xp integer := 0;
  v_bonus integer := 0;
  v_occurrence integer;
  v_total_before integer;
  v_total_after integer;
  v_category text;
  v_coin integer := 0;
  v_coins_awarded integer := 0;
  v_amount integer;
  v_lvl integer;
  v_titles text[] := '{}';
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

  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  select coalesce(sum(amount), 0) into v_total_before from public.xp_transactions where user_id = v_user;

  insert into public.habit_logs (user_id, habit_id, local_date, qty)
  values (v_user, p_habit_id, p_local_date, p_qty)
  on conflict (habit_id, local_date) do nothing
  returning id into v_log_id;

  if v_log_id is not null then
    -- ── XP ──
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

    -- ── Cristais da missão ──
    v_class := public.equipped_class(v_user);
    select timezone into v_tz from public.profiles where id = v_user;
    select o.category into v_category from public.objectives o where o.id = v_habit.objective_id;

    select amount into v_coin from public.coin_rules where key = 'coin_' || v_habit.difficulty::text;
    v_coin := coalesce(v_coin, 0);
    if p_local_date < v_today and not v_class.yesterday_full then
      v_coin := ceil(v_coin / 2.0)::integer;
    end if;
    if v_class.area is not null and coalesce(v_category, 'personal_growth') = v_class.area then
      v_coin := v_coin + ceil(v_coin * v_class.area_pct / 100.0)::integer;
    end if;
    v_coin := v_coin + case v_habit.difficulty
      when 'easy' then v_class.easy_extra
      when 'medium' then v_class.medium_extra
      else v_class.hard_extra end;
    if v_class.night_extra > 0 and p_local_date = v_today
       and extract(hour from now() at time zone v_tz) >= 20 then
      v_coin := v_coin + v_class.night_extra;
    end if;

    if v_coin > 0 then
      insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
      values (v_user, v_coin, 'habit', v_log_id, p_local_date, 'coins:habit-log:' || v_log_id::text);
      v_coins_awarded := v_coins_awarded + v_coin;
    end if;

    -- ── Cristais do dia perfeito ──
    if v_bonus > 0 then
      select amount into v_amount from public.coin_rules where key = 'coin_perfect_day';
      v_amount := coalesce(v_amount, 0) + v_class.perfect_day_extra;
      if v_amount > 0 then
        insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (
          v_user, v_amount, 'perfect_day', p_local_date,
          'coins:perfect-day:' || v_user::text || ':' || p_local_date::text || ':' || v_occurrence::text
        );
        v_coins_awarded := v_coins_awarded + v_amount;
      end if;
    end if;

    -- ── Cristais de subida de nível ──
    select coalesce(sum(amount), 0) into v_total_after from public.xp_transactions where user_id = v_user;
    select amount into v_amount from public.coin_rules where key = 'coin_level_up_per_level';
    for v_lvl in (public.level_from_xp(v_total_before) + 1)..public.level_from_xp(v_total_after) loop
      insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
      values (
        v_user, v_lvl * coalesce(v_amount, 0) + v_class.level_up_extra, 'level_up', p_local_date,
        'coins:level-up:' || v_user::text || ':' || v_lvl::text
      )
      on conflict (idempotency_key) do nothing;
      if found then
        v_coins_awarded := v_coins_awarded + v_lvl * coalesce(v_amount, 0) + v_class.level_up_extra;
      end if;
    end loop;

    -- ── Títulos (novo) ──
    v_titles := public.grant_titles(v_user, p_local_date, v_bonus > 0);
  end if;

  return jsonb_build_object(
    'logged', v_log_id is not null,
    'xp_awarded', v_xp,
    'perfect_day_bonus', v_bonus,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user),
    'coins_awarded', v_coins_awarded,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user),
    'titles_granted', to_jsonb(v_titles)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- complete_objective: o usuário declara um objetivo conquistado.
-- Exige pelo menos 10 registros em hábitos ligados a ele (evita conquista vazia).
-- Concede o título épico da área (uma vez por área) e +100 Cristais (uma vez por objetivo).
-- Erros: P0002 não encontrado · 22023 já concluído · PR006 poucos registros
-- ─────────────────────────────────────────────────────────────
create or replace function public.complete_objective(p_objective_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.objectives%rowtype;
  v_logs integer;
  v_title text;
  v_granted boolean := false;
  v_coins integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_obj from public.objectives where id = p_objective_id and user_id = v_user for update;
  if not found then
    raise exception 'Objetivo não encontrado' using errcode = 'P0002';
  end if;
  if v_obj.status = 'done' then
    raise exception 'Este objetivo já foi conquistado' using errcode = '22023';
  end if;

  select count(*) into v_logs
  from public.habit_logs l join public.habits h on h.id = l.habit_id
  where h.objective_id = p_objective_id and l.user_id = v_user;
  if v_logs < 10 then
    raise exception 'Faltam % registros para conquistar este objetivo', 10 - v_logs using errcode = 'PR006';
  end if;

  update public.objectives set status = 'done' where id = p_objective_id;

  v_title := 'conquista-' || v_obj.category;
  insert into public.user_titles (user_id, title_id) values (v_user, v_title) on conflict do nothing;
  v_granted := found;

  select amount into v_coins from public.coin_rules where key = 'coin_objective_done';
  insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
  values (v_user, coalesce(v_coins, 0), 'achievement', p_objective_id, public.user_today(v_user),
          'coins:objective:' || p_objective_id::text)
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'title', v_title,
    'title_new', v_granted,
    'coins_awarded', coalesce(v_coins, 0),
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

-- Progresso dos objetivos ativos (para o botão "Conquistei").
create or replace function public.my_objectives_progress()
returns table (id uuid, title text, category text, logs integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.id, o.title, o.category, count(l.id)::integer
  from public.objectives o
  left join public.habits h on h.objective_id = o.id
  left join public.habit_logs l on l.habit_id = h.id
  where o.user_id = (select auth.uid()) and o.status = 'active'
  group by o.id, o.title, o.category, o.created_at
  order by o.created_at;
$$;

revoke execute on function public.grant_titles(uuid, date, boolean) from public, anon, authenticated;
revoke execute on function public.profiles_guard_equipped_title() from public, anon, authenticated;
revoke execute on function public.complete_objective(uuid) from public, anon;
revoke execute on function public.my_objectives_progress() from public, anon;
revoke execute on function public.log_habit(uuid, date, numeric) from public, anon;
grant execute on function public.complete_objective(uuid) to authenticated;
grant execute on function public.my_objectives_progress() to authenticated;
grant execute on function public.log_habit(uuid, date, numeric) to authenticated;
