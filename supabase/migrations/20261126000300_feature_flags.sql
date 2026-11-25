-- Feature flags para os recursos anteriores à regra "todo recurso atrás de flag" (AGENTS.md).
--   · Linhas feature_<nome> em app_settings, todas LIGADAS (1): os testers já usam esses recursos.
--   · Para recursos antigos, linha ausente também conta como ligada (só 0 desliga). Recursos
--     novos, como o diário de humor, exigem 1.
--   · Desligar esconde a interface no app e faz as funções de escrita recusarem com PR050. Os dados
--     já gravados continuam. Ler (listas, saldos) segue liberado.
-- Para desligar, por exemplo, a Loja:
--   update public.app_settings set value = 0 where key = 'feature_shop';
--
-- Funções de escrita: em vez de copiar o corpo, cada uma é renomeada para <nome>__impl e ganha no
-- lugar um "porteiro" com o mesmo nome e os mesmos parâmetros, que confere a flag e repassa a
-- chamada. O comportamento de cada função não muda.

create or replace function public.feature_on(p_key text, p_default integer default 0)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.app_settings where key = p_key), p_default) = 1
$$;

create or replace function public.require_feature(p_key text, p_default integer default 0)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.feature_on(p_key, p_default) then
    raise exception 'Este recurso está desativado no momento' using errcode = 'PR050';
  end if;
end;
$$;

revoke execute on function public.feature_on(text, integer) from public, anon;
revoke execute on function public.require_feature(text, integer) from public, anon;
grant execute on function public.feature_on(text, integer) to authenticated, service_role;
grant execute on function public.require_feature(text, integer) to authenticated, service_role;

insert into public.app_settings (key, value) values
  ('feature_shop', 1),
  ('feature_challenges', 1),
  ('feature_social', 1),
  ('feature_habit_kinds', 1),
  ('feature_habit_stats', 1),
  ('feature_flash_mission', 1),
  ('feature_streak_shields', 1),
  ('feature_oracle', 1),
  ('feature_smart_notifications', 1)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Porteiros das funções de escrita (gerados a partir do catálogo)
-- ─────────────────────────────────────────────────────────────
do $gate$
declare
  g record;
  fn oid;
  args text;
  idargs text;
  res text;
  retset boolean;
  call_args text;
  body text;
begin
  for g in
    select * from (values
      ('buy_cosmetic', 'feature_shop'),
      ('redeem_reward', 'feature_shop'),
      ('start_journey', 'feature_challenges'),
      ('resolve_journey', 'feature_challenges'),
      ('abandon_journey', 'feature_challenges'),
      ('claim_weekly_boss', 'feature_challenges'),
      ('send_friend_request', 'feature_social'),
      ('respond_friend_request', 'feature_social'),
      ('search_users', 'feature_social'),
      ('create_group', 'feature_social'),
      ('join_group', 'feature_social'),
      ('claim_group_boss', 'feature_social'),
      ('buy_streak_shield', 'feature_streak_shields'),
      ('use_streak_shield', 'feature_streak_shields'),
      ('my_flash_mission', 'feature_flash_mission')
    ) as t(fname, flag)
  loop
    select p.oid into strict fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = g.fname;

    args := pg_get_function_arguments(fn);
    idargs := pg_get_function_identity_arguments(fn);
    res := pg_get_function_result(fn);
    select p.proretset into retset from pg_proc p where p.oid = fn;
    call_args := '';
    if (select p.proargnames is not null from pg_proc p where p.oid = fn) then
      select coalesce(string_agg(format('%1$I => %1$I', a.name), ', ' order by a.ord), '')
        into call_args
      from pg_proc p,
           unnest(p.proargnames, coalesce(p.proargmodes, array_fill('i'::"char", array[cardinality(p.proargnames)])))
             with ordinality as a(name, mode, ord)
      where p.oid = fn and a.mode in ('i', 'b', 'v');
    end if;

    execute format('alter function public.%I(%s) rename to %I', g.fname, idargs, g.fname || '__impl');

    body := case
      when res = 'void' then format('perform public.%I(%s);', g.fname || '__impl', call_args)
      when retset then format('return query select * from public.%I(%s);', g.fname || '__impl', call_args)
      else format('return public.%I(%s);', g.fname || '__impl', call_args)
    end;

    execute format(
      'create function public.%I(%s) returns %s language plpgsql security definer set search_path = '''' as $w$ '
      'begin perform public.require_feature(%L, 1); %s end $w$',
      g.fname, args, res, g.flag, body);

    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated',
                   g.fname || '__impl', idargs);
    execute format('revoke execute on function public.%I(%s) from public, anon', g.fname, idargs);
    execute format('grant execute on function public.%I(%s) to authenticated', g.fname, idargs);
  end loop;
end
$gate$;

-- ─────────────────────────────────────────────────────────────
-- Oráculo: a Edge Function ai-plan consulta ai_plan_block_reason (service role) antes de gerar
-- um plano; com a flag desligada, o motivo do bloqueio é a própria flag.
-- ─────────────────────────────────────────────────────────────
alter function public.ai_plan_block_reason(uuid, text) rename to ai_plan_block_reason__impl;

create function public.ai_plan_block_reason(p_user_id uuid, p_kind text)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.feature_on('feature_oracle', 1) then
    return 'O Oráculo está desativado no momento. Tente mais tarde.';
  end if;
  return public.ai_plan_block_reason__impl(p_user_id, p_kind);
end;
$$;

revoke execute on function public.ai_plan_block_reason__impl(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_plan_block_reason__impl(uuid, text) to service_role;
revoke execute on function public.ai_plan_block_reason(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_plan_block_reason(uuid, text) to service_role;
