-- Lorde do mês (espelha packages/domain/src/monthlyBoss.ts; documento "Chefes a longo prazo").
--   · Um chefe do rodízio, na forma lendária, fica o mês inteiro: vida = 70% das missões agendadas
--     no mês, cada missão feita tira 1. Gira pelos 6 do Ato I, ou pelos 12 quando o Ato II já está no
--     rodízio no dia 1º (mesma conta de monthlyBossFor).
--   · Prêmio (app_settings.monthly_boss_reward, padrão 200 Cristais) resgatado até o dia 7 do mês
--     seguinte; a vitória fica em monthly_boss_victories.
--   · Feature flag: app_settings.feature_monthly_boss (começa desligada). Desligada, o app não
--     mostra o Lorde e claim_monthly_boss recusa com PR050. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_monthly_boss';
-- Erros: 22023 fora do prazo ou data que não é dia 1º · PR033 Lorde ainda de pé.

insert into public.app_settings (key, value) values
  ('feature_monthly_boss', 0),
  ('monthly_boss_reward', 200);

create table public.monthly_boss_victories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month_start date not null,
  boss_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, month_start)
);
alter table public.monthly_boss_victories enable row level security;
create policy "monthly_boss_victories: ler o próprio" on public.monthly_boss_victories
  for select to authenticated using (user_id = auth.uid());
revoke all on public.monthly_boss_victories from anon, authenticated;
grant select on public.monthly_boss_victories to authenticated;

create or replace function public.monthly_boss_for(p_month_start date)
returns text
language sql
stable
set search_path = ''
as $$
  with cfg as (
    select (extract(year from p_month_start)::integer - 1970) * 12 + extract(month from p_month_start)::integer - 1 as n,
           (p_month_start - date '1970-01-01') / 7 as week,
           case when public.feature_on('feature_act_2')
                then coalesce((select value from public.app_settings where key = 'boss_act2_start_week'), 0)
                else 0 end as start
  )
  select case
    when cfg.start > 0 and cfg.week >= cfg.start then
      (array['golem', 'hidra', 'lich', 'dragao', 'sombra', 'basilisco',
             'kraken', 'quimera', 'banshee', 'vampiro', 'mimico', 'medusa'])[cfg.n % 12 + 1]
    else (array['golem', 'hidra', 'lich', 'dragao', 'sombra', 'basilisco'])[cfg.n % 6 + 1]
  end
  from cfg
$$;
revoke execute on function public.monthly_boss_for(date) from public, anon;
grant execute on function public.monthly_boss_for(date) to authenticated;

create or replace function public.monthly_boss_status(p_user uuid, p_month_start date)
returns table (max_hp integer, damage integer)
language sql
stable
security definer
set search_path = ''
as $$
  with slots as (
    select h.id, d::date as day
    from public.habits h
    cross join generate_series(p_month_start, (p_month_start + interval '1 month' - interval '1 day')::date,
                               interval '1 day') d
    where h.user_id = p_user and public.habit_scheduled_on(h, d::date)
  )
  select ceil(count(*) * 70 / 100.0)::integer,
         count(*) filter (where exists (select 1 from public.habit_logs l
                                        where l.habit_id = s.id and l.local_date = s.day))::integer
  from slots s
$$;
revoke execute on function public.monthly_boss_status(uuid, date) from public, anon, authenticated;

create or replace function public.claim_monthly_boss(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_end date;
  v_s record;
  v_amount integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_monthly_boss');
  if p_month_start is null or extract(day from p_month_start) <> 1 then
    raise exception 'O mês começa no dia 1º' using errcode = '22023';
  end if;
  v_today := public.user_today(v_user);
  v_end := (p_month_start + interval '1 month' - interval '1 day')::date;
  if v_today < p_month_start or v_today > v_end + 7 then
    raise exception 'Fora do prazo do Lorde do mês' using errcode = '22023';
  end if;
  select * into v_s from public.monthly_boss_status(v_user, p_month_start);
  if v_s.max_hp = 0 or v_s.damage < v_s.max_hp then
    raise exception 'O Lorde do mês ainda está de pé' using errcode = 'PR033';
  end if;

  v_amount := coalesce((select value from public.app_settings where key = 'monthly_boss_reward'), 200);
  if v_amount > 0 then
    insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
    values (v_user, v_amount, 'challenge', 'month-boss:' || p_month_start, v_today,
            'coins:month-boss:' || v_user || ':' || p_month_start)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  end if;
  insert into public.monthly_boss_victories (user_id, month_start, boss_id)
  values (v_user, p_month_start, public.monthly_boss_for(p_month_start))
  on conflict do nothing;

  return jsonb_build_object(
    'claimed', v_id is not null,
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;
revoke execute on function public.claim_monthly_boss(date) from public, anon;
grant execute on function public.claim_monthly_boss(date) to authenticated;

-- Exportação dos dados (LGPD) passa a incluir as vitórias contra o Lorde do mês.
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
    'mood_entries', 'feedback', 'group_members', 'vacations', 'boss_victories', 'ambush_victories', 'monthly_boss_victories'
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
