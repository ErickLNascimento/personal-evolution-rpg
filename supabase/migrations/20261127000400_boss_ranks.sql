-- Patentes dos chefes e bestiário (espelha packages/domain/src/bossRanks.ts; documento de design
-- "Chefes a longo prazo").
--   · O chefe da semana continua o mesmo para todos (boss_for_week = bossForWeek no app). A patente
--     é de cada pessoa: vitórias anteriores contra aquele chefe (Soldado 0, Capitão 1, General 2,
--     Lorde 3). Vida e prêmio por patente ficam em boss_ranks, que a equipe ajusta.
--   · A vitória conta no resgate (claim_weekly_boss), que grava boss_victories. Os resgates de
--     antes desta migration viram vitórias (patentes recalculadas em ordem).
--   · Feature flags (começam desligadas): feature_boss_ranks (desligada, todo chefe é Soldado com
--     a vida e o prêmio de antes) e feature_bestiary (só no app; o bestiário lê boss_victories).
--       update public.app_settings set value = 1 where key = 'feature_boss_ranks';
--       update public.app_settings set value = 1 where key = 'feature_bestiary';
--   · Chefe do bando: sem patente nesta fase.

insert into public.app_settings (key, value) values
  ('feature_boss_ranks', 0),
  ('feature_bestiary', 0);

create table public.boss_ranks (
  rank smallint primary key check (rank between 0 and 3),
  name text not null,
  hp_pct smallint not null check (hp_pct between 1 and 100),
  reward integer not null check (reward >= 0)
);
insert into public.boss_ranks (rank, name, hp_pct, reward) values
  (0, 'soldado', 80, 40),
  (1, 'capitao', 85, 60),
  (2, 'general', 90, 90),
  (3, 'lorde', 95, 130);
alter table public.boss_ranks enable row level security;
create policy "boss_ranks: todos leem" on public.boss_ranks for select to authenticated using (true);
revoke all on public.boss_ranks from anon, authenticated;
grant select on public.boss_ranks to authenticated;

-- Chefe da semana, na mesma ordem e conta de bossForWeek (semanas desde 1970, módulo 6).
create or replace function public.boss_for_week(p_week_start date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['golem', 'hidra', 'lich', 'dragao', 'sombra', 'basilisco'])[
    (((p_week_start - date '1970-01-01') / 7) % 6 + 6) % 6 + 1]
$$;

create table public.boss_victories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  boss_id text not null,
  rank smallint not null check (rank between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
create index boss_victories_user_boss on public.boss_victories (user_id, boss_id, week_start);
alter table public.boss_victories enable row level security;
create policy "boss_victories: ler o próprio" on public.boss_victories
  for select to authenticated using (user_id = auth.uid());
revoke all on public.boss_victories from anon, authenticated;
grant select on public.boss_victories to authenticated;

-- Resgates antigos viram vitórias, com a patente que teriam tido (vitórias anteriores, até 3).
insert into public.boss_victories (user_id, week_start, boss_id, rank, created_at)
select user_id, week_start, boss_id,
       least(row_number() over (partition by user_id, boss_id order by week_start) - 1, 3),
       created_at
from (
  select c.user_id, substring(c.item_id from 6)::date as week_start,
         public.boss_for_week(substring(c.item_id from 6)::date) as boss_id, c.created_at
  from public.coin_transactions c
  where c.source_type = 'challenge' and c.item_id like 'boss:%' and c.amount > 0
) t
on conflict do nothing;

-- Patente do chefe de uma semana para a pessoa (0 com a flag desligada).
create or replace function public.boss_rank(p_user uuid, p_week_start date)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case when not public.feature_on('feature_boss_ranks') then 0::smallint
    else least(3, (select count(*) from public.boss_victories v
                   where v.user_id = p_user and v.boss_id = public.boss_for_week(p_week_start)
                     and v.week_start < p_week_start))::smallint end
$$;

-- Vida pela patente (Soldado = 80%, como antes).
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
  ),
  pct as (
    select coalesce((select r.hp_pct from public.boss_ranks r
                     where r.rank = public.boss_rank(p_user, p_week_start)), 80) as v
  )
  select ceil(count(*) * (select v from pct) / 100.0)::integer,
         count(*) filter (where exists (select 1 from public.habit_logs l
                                        where l.habit_id = s.id and l.local_date = s.day))::integer
  from slots s
$$;

-- Resgate: prêmio pela patente e a vitória gravada (o porteiro claim_weekly_boss confere a flag
-- feature_challenges e chama esta).
create or replace function public.claim_weekly_boss__impl(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_this_week date;
  v_s record;
  v_rank smallint;
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

  v_rank := public.boss_rank(v_user, p_week_start);
  if public.feature_on('feature_boss_ranks') then
    select reward into v_amount from public.boss_ranks where rank = v_rank;
  else
    select amount into v_amount from public.coin_rules where key = 'coin_weekly_boss';
  end if;
  v_amount := coalesce(v_amount, 0);
  if v_amount > 0 then
    insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
    values (v_user, v_amount, 'challenge', 'boss:' || p_week_start, public.user_today(v_user),
            'coins:boss:' || v_user || ':' || p_week_start)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  end if;

  insert into public.boss_victories (user_id, week_start, boss_id, rank)
  values (v_user, p_week_start, public.boss_for_week(p_week_start), v_rank)
  on conflict do nothing;

  return jsonb_build_object(
    'claimed', v_id is not null,
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'rank', v_rank,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

revoke execute on function public.boss_for_week(date) from public, anon;
grant execute on function public.boss_for_week(date) to authenticated;
revoke execute on function public.boss_rank(uuid, date) from public, anon, authenticated;
revoke execute on function public.weekly_boss_status(uuid, date) from public, anon, authenticated;
revoke execute on function public.claim_weekly_boss__impl(date) from public, anon, authenticated;

-- Exportação dos dados (LGPD) passa a incluir as vitórias.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_out jsonb;
  v_rows jsonb;
  t text;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_data_export');

  v_out := jsonb_build_object(
    'formato', 'Personal Evolution RPG: exportação de dados pessoais (LGPD), versão 1',
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'id', v_user,
      'email', (select u.email from auth.users u where u.id = v_user)
    ),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = v_user)
  );

  -- Tabelas com user_id: todas as linhas do usuário, sem repetir o user_id em cada uma.
  foreach t in array array[
    'objectives', 'habits', 'habit_logs', 'habit_counts', 'xp_transactions', 'coin_transactions',
    'user_titles', 'user_unlocks', 'user_cosmetics', 'hero_history', 'flash_missions',
    'streak_shield_uses', 'custom_rewards', 'reward_redemptions', 'ai_plans', 'journeys',
    'mood_entries', 'feedback', 'group_members', 'vacations', 'boss_victories'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''user_id''), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into v_rows using v_user;
    v_out := v_out || jsonb_build_object(t, v_rows);
  end loop;

  -- Vínculos sociais: só o id do outro e a situação (nada dos dados pessoais dele).
  v_out := v_out || jsonb_build_object(
    'friendships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'outro_usuario', case when f.requester = v_user then f.addressee else f.requester end,
        'enviado_por_mim', f.requester = v_user,
        'status', f.status,
        'criado_em', f.created_at,
        'aceito_em', f.accepted_at))
      from public.friendships f where v_user in (f.requester, f.addressee)), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.name, 'sou_dono', g.owner = v_user,
                                          'criado_em', g.created_at))
      from public.groups g join public.group_members m on m.group_id = g.id and m.user_id = v_user), '[]'::jsonb)
  );
  return v_out;
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
