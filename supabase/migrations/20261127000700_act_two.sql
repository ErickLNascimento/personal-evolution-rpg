-- Ato II dos chefes (espelha ACT_II_BOSSES, bossForWeek e setBossCalendar em
-- packages/domain/src/challenges.ts; documento "Chefes a longo prazo", camada 5).
--   · Seis chefes novos: kraken, quimera, banshee, vampiro, mimico, medusa.
--   · Entram no rodízio a partir da semana boss_act2_start_week (número de semanas desde 1970, a
--     mesma conta do app; 0 = não começou). Dali em diante o rodízio tem 12, alternando novo e
--     antigo e começando por um novo. Semanas anteriores mantêm o chefe que tiveram.
--   · Feature flag: app_settings.feature_act_2 (começa desligada = só o Ato I). Para ligar, marque
--     a segunda-feira de início e ligue a flag (não desligue depois de começar: as semanas já
--     vividas voltariam aos chefes do Ato I):
--       update public.app_settings set value = ('2026-12-07'::date - date '1970-01-01') / 7
--         where key = 'boss_act2_start_week';
--       update public.app_settings set value = 1 where key = 'feature_act_2';

insert into public.app_settings (key, value) values
  ('feature_act_2', 0),
  ('boss_act2_start_week', 0);

create or replace function public.boss_for_week(p_week_start date)
returns text
language sql
stable
set search_path = ''
as $$
  with cfg as (
    select (p_week_start - date '1970-01-01') / 7 as week,
           case when public.feature_on('feature_act_2')
                then coalesce((select value from public.app_settings where key = 'boss_act2_start_week'), 0)
                else 0 end as start
  )
  select case
    when cfg.start > 0 and cfg.week >= cfg.start then
      (array['kraken', 'golem', 'quimera', 'hidra', 'banshee', 'lich',
             'vampiro', 'dragao', 'mimico', 'sombra', 'medusa', 'basilisco'])[(cfg.week - cfg.start) % 12 + 1]
    else (array['golem', 'hidra', 'lich', 'dragao', 'sombra', 'basilisco'])[(cfg.week % 6 + 6) % 6 + 1]
  end
  from cfg
$$;
revoke execute on function public.boss_for_week(date) from public, anon;
grant execute on function public.boss_for_week(date) to authenticated;

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
    when 'kraken' then 'personal_growth'
    when 'quimera' then 'relationships'
    when 'banshee' then 'wellbeing'
    when 'vampiro' then 'health'
    when 'mimico' then 'knowledge'
    when 'medusa' then 'finance'
  end
$$;
