-- Desafios com prazo (espelha packages/domain/src/challenges.ts).
--   · Jornada: um hábito, 21 ou 66 dias; vence com o hábito feito em ≥ 80% dos dias da agenda
--     no prazo. Vence antes do fim ao bater o mínimo; perde antes se as faltas passarem do limite.
--   · Chefe da semana: vida = 80% das missões agendadas na semana (segunda a domingo);
--     cada missão feita tira 1. Derrotado, rende Cristais (resgate na semana ou na seguinte).
-- Prêmios só em Cristais, concedidos aqui. Chaves de idempotência:
--   coins:journey:<uuid>           jornada vencida (item_id = 'journey:<uuid>')
--   coins:boss:<user>:<segunda>    chefe derrotado (item_id = 'boss:<segunda>')

insert into public.coin_rules (key, amount) values
  ('coin_journey_21', 120),
  ('coin_journey_66', 450),
  ('coin_weekly_boss', 40);

alter table public.coin_transactions drop constraint coin_transactions_source_type_check;
alter table public.coin_transactions add constraint coin_transactions_source_type_check
  check (source_type in ('habit', 'perfect_day', 'level_up', 'purchase', 'reversal', 'achievement', 'flash', 'refund', 'challenge'));

-- O hábito vale nesta data? (mesma regra de isHabitScheduledOn no domínio)
create or replace function public.habit_scheduled_on(p_habit public.habits, p_date date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_date >= p_habit.start_date
    and (p_habit.archived_on is null or p_date <= p_habit.archived_on)
    and extract(dow from p_date)::smallint = any (p_habit.schedule_days)
$$;

-- ─────────────────────────────────────────────────────────────
-- Jornadas
-- ─────────────────────────────────────────────────────────────
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  length_days integer not null check (length_days in (21, 66)),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'won', 'lost', 'abandoned')),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index journeys_one_active_per_habit on public.journeys (habit_id) where status = 'active';
create index journeys_user_idx on public.journeys (user_id, created_at desc);

alter table public.journeys enable row level security;
create policy "journeys: ler o próprio" on public.journeys
  for select to authenticated using (user_id = auth.uid());
revoke all on public.journeys from anon, authenticated;
grant select on public.journeys to authenticated;

-- Progresso de uma jornada: dias da agenda, mínimo para vencer, feitos e faltas já fechadas.
create or replace function public.journey_progress(p_journey public.journeys)
returns table (scheduled integer, required integer, done integer, missed integer, closed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_habit public.habits%rowtype;
  v_end date := p_journey.start_date + p_journey.length_days - 1;
  v_closed_until date := public.user_today(p_journey.user_id) - 2; -- anteontem já não aceita registro
begin
  select * into v_habit from public.habits where id = p_journey.habit_id;

  select count(*) filter (where public.habit_scheduled_on(v_habit, d::date)),
         count(*) filter (where public.habit_scheduled_on(v_habit, d::date)
                            and d::date <= v_closed_until
                            and not exists (select 1 from public.habit_logs l
                                            where l.habit_id = v_habit.id and l.local_date = d::date))
    into scheduled, missed
  from generate_series(p_journey.start_date, v_end, interval '1 day') d;

  select count(*) into done from public.habit_logs l
  where l.habit_id = v_habit.id and l.local_date between p_journey.start_date and v_end;

  required := ceil(scheduled * 80 / 100.0)::integer;
  closed := v_end <= v_closed_until;
  return next;
end;
$$;

create or replace function public.start_journey(p_habit_id uuid, p_length integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_habit public.habits%rowtype;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_length not in (21, 66) then
    raise exception 'Duração inválida' using errcode = '22023';
  end if;
  select * into v_habit from public.habits where id = p_habit_id and user_id = v_user;
  if not found or v_habit.archived_on is not null then
    raise exception 'Hábito não encontrado' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('journey:' || v_user::text));
  if exists (select 1 from public.journeys where habit_id = p_habit_id and status = 'active') then
    raise exception 'Este hábito já está numa jornada' using errcode = 'PR030';
  end if;
  if (select count(*) from public.journeys where user_id = v_user and status = 'active') >= 3 then
    raise exception 'Limite de jornadas em andamento' using errcode = 'PR031';
  end if;

  insert into public.journeys (user_id, habit_id, length_days, start_date)
  values (v_user, p_habit_id, p_length, public.user_today(v_user))
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

-- Fecha a jornada se o resultado já está decidido; vencida, paga os Cristais (uma vez).
create or replace function public.resolve_journey(p_journey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_journey public.journeys%rowtype;
  v_p record;
  v_status text;
  v_amount integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into v_journey from public.journeys where id = p_journey_id and user_id = v_user for update;
  if not found then
    raise exception 'Jornada não encontrada' using errcode = 'P0002';
  end if;

  if v_journey.status = 'active' then
    select * into v_p from public.journey_progress(v_journey);
    if v_p.scheduled > 0 and v_p.done >= v_p.required then
      v_status := 'won';
    elsif v_p.missed > v_p.scheduled - v_p.required or v_p.closed then
      v_status := 'lost';
    end if;

    if v_status is not null then
      update public.journeys set status = v_status, finished_at = now() where id = v_journey.id;
      v_journey.status := v_status;
      if v_status = 'won' then
        select amount into v_amount from public.coin_rules where key = 'coin_journey_' || v_journey.length_days;
        v_amount := coalesce(v_amount, 0);
        if v_amount > 0 then
          insert into public.coin_transactions (user_id, amount, source_type, source_id, item_id, local_date, idempotency_key)
          values (v_user, v_amount, 'challenge', v_journey.id, 'journey:' || v_journey.id,
                  public.user_today(v_user), 'coins:journey:' || v_journey.id)
          on conflict (idempotency_key) do nothing;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'status', v_journey.status,
    'coins_awarded', v_amount,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

create or replace function public.abandon_journey(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  update public.journeys set status = 'abandoned', finished_at = now()
  where id = p_journey_id and user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Jornada não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Chefe da semana
-- ─────────────────────────────────────────────────────────────
create or replace function public.weekly_boss_status(p_user uuid, p_week_start date)
returns table (max_hp integer, damage integer)
language sql
stable
security definer
set search_path = ''
as $$
  with slots as (
    select h.id, d::date as day
    from public.habits h
    cross join generate_series(p_week_start, p_week_start + 6, interval '1 day') d
    where h.user_id = p_user and public.habit_scheduled_on(h, d::date)
  )
  select ceil(count(*) * 80 / 100.0)::integer,
         count(*) filter (where exists (select 1 from public.habit_logs l
                                        where l.habit_id = s.id and l.local_date = s.day))::integer
  from slots s
$$;

create or replace function public.claim_weekly_boss(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_this_week date;
  v_s record;
  v_amount integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  v_this_week := date_trunc('week', public.user_today(v_user))::date; -- segunda-feira
  if p_week_start not in (v_this_week, v_this_week - 7) then
    raise exception 'Só dá para resgatar o chefe desta semana ou da anterior' using errcode = '22023';
  end if;

  select * into v_s from public.weekly_boss_status(v_user, p_week_start);
  if v_s.max_hp = 0 or v_s.damage < v_s.max_hp then
    raise exception 'O chefe ainda não foi derrotado' using errcode = 'PR032';
  end if;

  select amount into v_amount from public.coin_rules where key = 'coin_weekly_boss';
  v_amount := coalesce(v_amount, 0);
  if v_amount > 0 then
    insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
    values (v_user, v_amount, 'challenge', 'boss:' || p_week_start, public.user_today(v_user),
            'coins:boss:' || v_user || ':' || p_week_start)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'claimed', v_id is not null,
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

revoke execute on function public.habit_scheduled_on(public.habits, date) from public, anon;
revoke execute on function public.journey_progress(public.journeys) from public, anon, authenticated;
revoke execute on function public.weekly_boss_status(uuid, date) from public, anon, authenticated;
revoke execute on function public.start_journey(uuid, integer) from public, anon;
revoke execute on function public.resolve_journey(uuid) from public, anon;
revoke execute on function public.abandon_journey(uuid) from public, anon;
revoke execute on function public.claim_weekly_boss(date) from public, anon;
grant execute on function public.start_journey(uuid, integer) to authenticated;
grant execute on function public.resolve_journey(uuid) to authenticated;
grant execute on function public.abandon_journey(uuid) to authenticated;
grant execute on function public.claim_weekly_boss(date) to authenticated;
