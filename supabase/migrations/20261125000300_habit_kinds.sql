-- Tipos de hábito.
--   · do:    fazer algo (o de sempre; um toque conclui).
--   · avoid: evitar algo ("Não fumar"); conclui quando o usuário confirma que resistiu no dia.
--   · count: contador com meta inteira por dia ("8 copos de água"). O progresso parcial fica em
--            habit_counts; ao bater a meta, set_habit_count chama log_habit (que dá o XP), e ao
--            voltar abaixo dela chama undo_habit_log. O XP continua saindo só dessas duas funções.

alter table public.habits
  add column kind text not null default 'do' check (kind in ('do', 'avoid', 'count'));

alter table public.habits
  add constraint habits_count_target check (
    kind <> 'count' or (target_qty is not null and target_qty = trunc(target_qty) and target_qty between 1 and 1000)
  );

-- ─────────────────────────────────────────────────────────────
-- habit_counts (somente leitura para o app; escrita via set_habit_count)
-- ─────────────────────────────────────────────────────────────
create table public.habit_counts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  local_date date not null,
  qty integer not null check (qty between 0 and 9999),
  updated_at timestamptz not null default now(),
  primary key (habit_id, local_date)
);

create index habit_counts_user_date_idx on public.habit_counts (user_id, local_date);

alter table public.habit_counts enable row level security;
create policy "habit_counts: ler o próprio" on public.habit_counts
  for select to authenticated using (user_id = auth.uid());
revoke all on public.habit_counts from anon, authenticated;
grant select on public.habit_counts to authenticated;

-- ─────────────────────────────────────────────────────────────
-- set_habit_count: grava a contagem do dia (valor absoluto, então repetir é seguro)
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_habit_count(p_habit_id uuid, p_local_date date, p_qty integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_habit public.habits%rowtype;
  v_target integer;
  v_logged boolean;
  v_log jsonb;
  v_undo jsonb;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_habit from public.habits where id = p_habit_id and user_id = v_user;
  if not found then
    raise exception 'Hábito não encontrado' using errcode = 'P0002';
  end if;
  if v_habit.kind <> 'count' then
    raise exception 'Este hábito não é um contador' using errcode = '22023';
  end if;
  if p_qty is null or p_qty < 0 or p_qty > 9999 then
    raise exception 'Quantidade inválida' using errcode = '22023';
  end if;

  -- Mesma janela e agenda de log_habit (e também vale para baixar a contagem).
  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível registrar hoje ou ontem' using errcode = '22023';
  end if;
  if p_local_date < v_habit.start_date
     or (v_habit.archived_on is not null and p_local_date > v_habit.archived_on)
     or not (extract(dow from p_local_date)::smallint = any (v_habit.schedule_days)) then
    raise exception 'Hábito não agendado para esta data' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('count:' || p_habit_id::text || p_local_date::text));

  insert into public.habit_counts (user_id, habit_id, local_date, qty)
  values (v_user, p_habit_id, p_local_date, p_qty)
  on conflict (habit_id, local_date) do update set qty = excluded.qty, updated_at = now();

  v_target := v_habit.target_qty::integer;
  v_logged := exists (select 1 from public.habit_logs where habit_id = p_habit_id and local_date = p_local_date);

  if p_qty >= v_target and not v_logged then
    v_log := public.log_habit(p_habit_id, p_local_date, p_qty);
  elsif p_qty < v_target and v_logged then
    v_undo := public.undo_habit_log(p_habit_id, p_local_date);
  elsif v_logged then
    update public.habit_logs set qty = p_qty where habit_id = p_habit_id and local_date = p_local_date;
  end if;

  return jsonb_build_object(
    'qty', p_qty,
    'target', v_target,
    'done', p_qty >= v_target,
    'log', v_log,
    'undo', v_undo
  );
end;
$$;

revoke execute on function public.set_habit_count(uuid, date, integer) from public, anon;
grant execute on function public.set_habit_count(uuid, date, integer) to authenticated;
