-- Emboscadas (espelha packages/domain/src/ambush.ts; documento "Chefes a longo prazo", camada 4).
--   · Um minichefe aparece por 2 dias com um desafio curto. Sorteio por pessoa e semana
--     (hashtext do usuário + segunda): 1 em cada 3 semanas, começando numa quarta ou num sábado.
--     Nunca nas 2 primeiras semanas de uso (primeiro hábito) nem com férias nos 2 dias.
--   · Desafios (ambush_progress): goblin 4 missões · slime 3 de Produtividade · morcego os 2 dias
--     perfeitos · diabrete 3 de Bem-estar · esqueleto 2 difíceis. Prêmio em Cristais, resgatado
--     até o dia seguinte ao fim (claim_ambush); a vitória fica em ambush_victories.
--   · Feature flag: app_settings.feature_ambush (começa desligada). Desligada, my_ambush devolve
--     null e claim_ambush recusa com PR050. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_ambush';
-- Erros: P0002 emboscada não encontrada · 22023 fora do prazo · PR040 desafio incompleto.

insert into public.app_settings (key, value) values ('feature_ambush', 0);

create table public.ambush_victories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  ambusher text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, start_date)
);
alter table public.ambush_victories enable row level security;
create policy "ambush_victories: ler o próprio" on public.ambush_victories
  for select to authenticated using (user_id = auth.uid());
revoke all on public.ambush_victories from anon, authenticated;
grant select on public.ambush_victories to authenticated;

-- Emboscada sorteada para a pessoa na semana (segunda p_week_start); nenhuma linha = sem emboscada.
create or replace function public.ambush_for_week(p_user uuid, p_week_start date)
returns table (ambusher text, start_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h bigint := abs(hashtext(p_user::text || ':' || p_week_start::text)::bigint);
  s date;
  v_first date;
begin
  if h % 3 <> 0 then
    return;
  end if;
  s := p_week_start + case when (h / 3) % 2 = 0 then 2 else 5 end; -- quarta ou sábado
  select min(x.start_date) into v_first from public.habits x where x.user_id = p_user;
  if v_first is null or v_first > s - 14 then
    return; -- nas duas primeiras semanas de uso, não
  end if;
  if public.on_vacation(p_user, s) or public.on_vacation(p_user, s + 1) then
    return;
  end if;
  ambusher := (array['goblin', 'slime', 'morcego', 'diabrete', 'esqueleto'])[(h / 6) % 5 + 1];
  start_date := s;
  return next;
end;
$$;

create or replace function public.ambush_reward(p_ambusher text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_ambusher when 'slime' then 15 when 'morcego' then 25 else 20 end
$$;

-- Progresso do desafio nos 2 dias (mesma conta de ambushProgress no app).
create or replace function public.ambush_progress(p_user uuid, p_ambusher text, p_start date)
returns table (done integer, target integer)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (select (p_start + k) as d from generate_series(0, 1) k),
  logs as (
    select l.local_date, h.difficulty::text as difficulty, o.category
    from public.habit_logs l
    join public.habits h on h.id = l.habit_id
    left join public.objectives o on o.id = h.objective_id
    where l.user_id = p_user and l.local_date between p_start and p_start + 1
  ),
  perfect as (
    select count(*) as n from days
    where exists (select 1 from public.habits h where h.user_id = p_user and public.habit_scheduled_on(h, days.d))
      and not exists (select 1 from public.habits h
                      where h.user_id = p_user and public.habit_scheduled_on(h, days.d)
                        and not exists (select 1 from public.habit_logs l
                                        where l.habit_id = h.id and l.local_date = days.d))
  ),
  goal as (
    select case p_ambusher when 'slime' then 3 when 'morcego' then 2 when 'diabrete' then 3
                           when 'esqueleto' then 2 else 4 end as target
  )
  select least((case p_ambusher
           when 'morcego' then (select n from perfect)
           when 'slime' then (select count(*) from logs where category = 'productivity')
           when 'diabrete' then (select count(*) from logs where category = 'wellbeing')
           when 'esqueleto' then (select count(*) from logs where difficulty = 'hard')
           else (select count(*) from logs) end)::integer, (select target from goal)),
         (select target from goal)
$$;

-- A emboscada que importa hoje: em andamento ou encerrada ontem (resgate), senão a próxima da semana.
create or replace function public.my_ambush()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_week date;
  a record;
  p record;
  best jsonb := null;
begin
  if v_user is null or not public.feature_on('feature_ambush') then
    return null;
  end if;
  v_today := public.user_today(v_user);
  v_week := date_trunc('week', v_today)::date;
  for a in select * from public.ambush_for_week(v_user, v_week - 7)
           union all select * from public.ambush_for_week(v_user, v_week) loop
    if v_today > a.start_date + 2 then
      continue; -- já passou o dia de resgate
    end if;
    select * into p from public.ambush_progress(v_user, a.ambusher, a.start_date);
    best := jsonb_build_object(
      'ambusher', a.ambusher, 'start_date', a.start_date, 'end_date', a.start_date + 1,
      'done', p.done, 'target', p.target, 'reward', public.ambush_reward(a.ambusher),
      'claimed', exists (select 1 from public.ambush_victories v
                         where v.user_id = v_user and v.start_date = a.start_date));
    if v_today >= a.start_date then
      return best; -- em andamento ou no dia de resgate: é esta
    end if;
  end loop;
  return best; -- a próxima (ainda por vir), ou null
end;
$$;

create or replace function public.claim_ambush(p_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  a record;
  p record;
  v_amount integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_ambush');
  select * into a from public.ambush_for_week(v_user, date_trunc('week', p_start)::date) x
  where x.start_date = p_start;
  if not found then
    raise exception 'Emboscada não encontrada' using errcode = 'P0002';
  end if;
  v_today := public.user_today(v_user);
  if v_today < a.start_date or v_today > a.start_date + 2 then
    raise exception 'Fora do prazo da emboscada' using errcode = '22023';
  end if;
  select * into p from public.ambush_progress(v_user, a.ambusher, a.start_date);
  if p.done < p.target then
    raise exception 'O desafio ainda não foi cumprido' using errcode = 'PR040';
  end if;

  v_amount := public.ambush_reward(a.ambusher);
  insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
  values (v_user, v_amount, 'challenge', 'ambush:' || a.start_date, v_today,
          'coins:ambush:' || v_user || ':' || a.start_date)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  insert into public.ambush_victories (user_id, start_date, ambusher)
  values (v_user, a.start_date, a.ambusher)
  on conflict do nothing;

  return jsonb_build_object(
    'claimed', v_id is not null,
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

revoke execute on function public.ambush_for_week(uuid, date) from public, anon, authenticated;
revoke execute on function public.ambush_progress(uuid, text, date) from public, anon, authenticated;
revoke execute on function public.ambush_reward(text) from public, anon;
grant execute on function public.ambush_reward(text) to authenticated;
revoke execute on function public.my_ambush() from public, anon;
revoke execute on function public.claim_ambush(date) from public, anon;
grant execute on function public.my_ambush() to authenticated;
grant execute on function public.claim_ambush(date) to authenticated;

-- Exportação dos dados (LGPD) passa a incluir as emboscadas vencidas.
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
    'mood_entries', 'feedback', 'group_members', 'vacations', 'boss_victories', 'ambush_victories'
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
