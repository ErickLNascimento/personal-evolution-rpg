-- Fraquezas dos chefes (espelha BOSS_WEAKNESS e missionDamage em packages/domain/src/challenges.ts;
-- documento de design "Chefes a longo prazo", camada 3).
--   · Cada chefe leva golpe dobrado das missões de uma área da vida (a categoria do objetivo do
--     hábito): a missão conta 2 de dano em vez de 1. A vida do chefe não muda.
--   · Hábito sem objetivo conta 1, como antes. Chefe do bando sem fraqueza nesta fase.
--   · Feature flag: app_settings.feature_boss_weakness (começa desligada = dano 1 para tudo).
--       update public.app_settings set value = 1 where key = 'feature_boss_weakness';

insert into public.app_settings (key, value) values ('feature_boss_weakness', 0);

create or replace function public.boss_weakness(p_boss text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_boss
    when 'golem' then 'health'
    when 'hidra' then 'productivity'
    when 'lich' then 'career'
    when 'dragao' then 'wellbeing'
    when 'sombra' then 'personal_growth'
    when 'basilisco' then 'relationships'
  end
$$;
revoke execute on function public.boss_weakness(text) from public, anon;
grant execute on function public.boss_weakness(text) to authenticated;

-- Vida pela patente (20261127000400) e dano com a fraqueza.
create or replace function public.weekly_boss_status(p_user uuid, p_week_start date)
returns table (max_hp integer, damage integer)
language sql
stable
security definer
set search_path = ''
as $$
  with slots as (
    select h.id, d::date as day, o.category
    from public.habits h
    left join public.objectives o on o.id = h.objective_id
    cross join generate_series(p_week_start, p_week_start + 6, interval '1 day') d
    where h.user_id = p_user and public.habit_scheduled_on(h, d::date)
  ),
  pct as (
    select coalesce((select r.hp_pct from public.boss_ranks r
                     where r.rank = public.boss_rank(p_user, p_week_start)), 80) as v
  ),
  weak as (
    select case when public.feature_on('feature_boss_weakness')
                then public.boss_weakness(public.boss_for_week(p_week_start)) end as cat
  )
  select ceil(count(*) * (select v from pct) / 100.0)::integer,
         coalesce(sum(case
           when not exists (select 1 from public.habit_logs l
                            where l.habit_id = s.id and l.local_date = s.day) then 0
           when s.category is not null and s.category = (select cat from weak) then 2
           else 1 end), 0)::integer
  from slots s
$$;
revoke execute on function public.weekly_boss_status(uuid, date) from public, anon, authenticated;
