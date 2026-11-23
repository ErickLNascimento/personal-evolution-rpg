-- Herói: aparência salva no perfil e XP por área (atributos).

-- Aparência montável (classe e peças). O app valida as peças pelo nível (domain/hero.ts);
-- aqui só garantimos um objeto pequeno.
alter table public.profiles
  add column hero jsonb not null default '{}'::jsonb,
  add constraint profiles_hero_shape check (jsonb_typeof(hero) = 'object' and pg_column_size(hero) <= 2048);

-- ─────────────────────────────────────────────────────────────
-- my_attribute_xp: XP ganho em hábitos por área do objetivo, para a ficha de atributos.
-- Usa o valor real de cada registro ativo (a dificuldade pode ter mudado depois).
-- Registros desfeitos não contam (o registro é apagado); bônus de dia perfeito não entra.
-- Hábito sem objetivo conta como "personal_growth".
-- security invoker: o RLS limita aos dados do próprio usuário.
-- ─────────────────────────────────────────────────────────────
create or replace function public.my_attribute_xp()
returns table (category text, xp integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(o.category, 'personal_growth') as category, sum(t.amount)::integer as xp
  from public.habit_logs l
  join public.xp_transactions t on t.source_type = 'habit' and t.source_id = l.id
  join public.habits h on h.id = l.habit_id
  left join public.objectives o on o.id = h.objective_id
  where l.user_id = (select auth.uid())
  group by 1;
$$;

revoke execute on function public.my_attribute_xp() from public, anon;
grant execute on function public.my_attribute_xp() to authenticated;
