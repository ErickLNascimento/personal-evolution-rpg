-- Missões em equipe (espelha packages/domain/src/duoQuests.ts).
--   · Um amigo convida outro para um desafio da semana (segunda a domingo de quem convida): cada
--     um faz N missões (3, 5 ou 7) numa área da vida, ou em qualquer área. Os dois precisam bater a
--     meta; ninguém carrega o outro.
--   · Prêmio para cada um: 30 / 50 / 80 Cristais (duo_reward), resgatado por cada pessoa depois que
--     os dois cumpriram, até 7 dias depois do fim da semana.
--   · Até 3 missões em equipe por pessoa por semana (pendentes + aceitas), uma por dupla.
--   · Privacidade: o parceiro vê só quantas missões da área você fez, nunca os nomes dos hábitos.
--   · Feature flag: app_settings.feature_duo_quests (começa desligada). Desligada, my_duo_quests
--     devolve lista vazia e as funções que gravam recusam com PR050. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_duo_quests';
-- Erros: PR070 não são amigos · PR071 limite da semana · PR072 dupla já tem missão na semana ·
--        PR073 meta ainda não cumprida pelos dois · PR074 fora do prazo · P0002 não encontrada ·
--        22023 meta ou área inválida.

insert into public.app_settings (key, value) values ('feature_duo_quests', 0);

create table public.duo_quests (
  id uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  inviter uuid not null references public.profiles (id) on delete cascade,
  partner uuid not null references public.profiles (id) on delete cascade,
  category text check (category in ('health', 'career', 'finance', 'knowledge', 'productivity',
                                    'relationships', 'wellbeing', 'personal_growth')),
  target integer not null check (target in (3, 5, 7)),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  inviter_claimed_at timestamptz,
  partner_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (inviter <> partner)
);

-- Uma missão por dupla por semana (em qualquer direção); recusada não conta.
create unique index duo_quests_pair_week on public.duo_quests
  (week_start, least(inviter, partner), greatest(inviter, partner)) where status <> 'declined';
create index duo_quests_inviter_idx on public.duo_quests (inviter, week_start);
create index duo_quests_partner_idx on public.duo_quests (partner, week_start);

alter table public.duo_quests enable row level security;
create policy "duo_quests: ler as minhas" on public.duo_quests
  for select to authenticated using (auth.uid() in (inviter, partner));
revoke all on public.duo_quests from anon, authenticated;
grant select on public.duo_quests to authenticated;

create or replace function public.duo_reward(p_target integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_target when 3 then 30 when 5 then 50 when 7 then 80 else 0 end
$$;

-- Missões feitas pela pessoa na semana, na área (null = qualquer), até a meta.
create or replace function public.duo_done(p_user uuid, p_week date, p_category text, p_target integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(count(*), p_target)::integer
  from public.habit_logs l
  join public.habits h on h.id = l.habit_id
  left join public.objectives o on o.id = h.objective_id
  where l.user_id = p_user
    and l.local_date between p_week and p_week + 6
    and (p_category is null or o.category::text = p_category)
$$;

-- Missões da semana atual e da anterior (prazo de resgate) em que a pessoa está.
create or replace function public.my_duo_quests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_week date;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if not public.feature_on('feature_duo_quests') then
    return '[]'::jsonb;
  end if;
  v_week := date_trunc('week', public.user_today(v_me))::date;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id,
             'week_start', q.week_start,
             'category', q.category,
             'target', q.target,
             'status', q.status,
             'i_invited', q.inviter = v_me,
             'reward', public.duo_reward(q.target),
             'partner', public.social_card(case when q.inviter = v_me then q.partner else q.inviter end),
             'my_done', public.duo_done(v_me, q.week_start, q.category, q.target),
             'partner_done', public.duo_done(case when q.inviter = v_me then q.partner else q.inviter end,
                                             q.week_start, q.category, q.target),
             'claimed', case when q.inviter = v_me then q.inviter_claimed_at else q.partner_claimed_at end is not null)
           order by q.week_start desc, q.created_at)
    from public.duo_quests q
    where v_me in (q.inviter, q.partner)
      and q.status <> 'declined'
      and q.week_start between v_week - 7 and v_week
      -- da semana passada, só as aceitas (o prazo de resgate); convite antigo não aceito some
      and (q.week_start = v_week or q.status = 'active')), '[]'::jsonb);
end;
$$;

create or replace function public.create_duo_quest(p_partner uuid, p_category text, p_target integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_week date;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_duo_quests');
  if p_target is null or p_target not in (3, 5, 7) then
    raise exception 'A meta é 3, 5 ou 7 missões' using errcode = '22023';
  end if;
  if p_category is not null and p_category not in ('health', 'career', 'finance', 'knowledge',
      'productivity', 'relationships', 'wellbeing', 'personal_growth') then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if p_partner is null or p_partner = v_me or not public.are_friends(v_me, p_partner) then
    raise exception 'Só dá para convidar amigos' using errcode = 'PR070';
  end if;
  v_week := date_trunc('week', public.user_today(v_me))::date;
  if exists (select 1 from public.duo_quests q
             where q.week_start = v_week and q.status <> 'declined'
               and least(q.inviter, q.partner) = least(v_me, p_partner)
               and greatest(q.inviter, q.partner) = greatest(v_me, p_partner)) then
    raise exception 'Vocês já têm uma missão em equipe nesta semana' using errcode = 'PR072';
  end if;
  if (select count(*) from public.duo_quests q
      where q.week_start = v_week and q.status <> 'declined' and v_me in (q.inviter, q.partner)) >= 3
     or (select count(*) from public.duo_quests q
         where q.week_start = v_week and q.status <> 'declined' and p_partner in (q.inviter, q.partner)) >= 3 then
    raise exception 'Limite de missões em equipe na semana' using errcode = 'PR071';
  end if;
  insert into public.duo_quests (week_start, inviter, partner, category, target)
  values (v_week, v_me, p_partner, p_category, p_target)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'week_start', v_week);
end;
$$;

-- O convidado aceita ou recusa um convite da semana atual de quem convidou.
create or replace function public.respond_duo_quest(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  q public.duo_quests;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_duo_quests');
  select * into q from public.duo_quests where id = p_id and partner = v_me and status = 'pending' for update;
  if not found then
    raise exception 'Convite não encontrado' using errcode = 'P0002';
  end if;
  if public.user_today(v_me) > q.week_start + 6 then
    raise exception 'A semana desse convite já acabou' using errcode = 'PR074';
  end if;
  if p_accept then
    update public.duo_quests set status = 'active', accepted_at = now() where id = p_id;
  else
    update public.duo_quests set status = 'declined' where id = p_id;
  end if;
end;
$$;

-- Quem convidou desiste de um convite ainda não aceito.
create or replace function public.cancel_duo_quest(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_duo_quests');
  delete from public.duo_quests where id = p_id and inviter = v_me and status = 'pending';
  if not found then
    raise exception 'Convite não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- Cada um resgata o próprio prêmio quando os dois cumpriram, até 7 dias depois do domingo.
create or replace function public.claim_duo_quest(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  q public.duo_quests;
  v_other uuid;
  v_today date;
  v_amount integer;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_duo_quests');
  select * into q from public.duo_quests
  where id = p_id and v_me in (inviter, partner) and status = 'active' for update;
  if not found then
    raise exception 'Missão em equipe não encontrada' using errcode = 'P0002';
  end if;
  v_today := public.user_today(v_me);
  if v_today > q.week_start + 13 then
    raise exception 'Fora do prazo de resgate' using errcode = 'PR074';
  end if;
  v_other := case when q.inviter = v_me then q.partner else q.inviter end;
  if public.duo_done(v_me, q.week_start, q.category, q.target) < q.target
     or public.duo_done(v_other, q.week_start, q.category, q.target) < q.target then
    raise exception 'A dupla ainda não cumpriu a meta' using errcode = 'PR073';
  end if;
  v_amount := public.duo_reward(q.target);
  insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
  values (v_me, v_amount, 'challenge', 'duo:' || q.id, v_today, 'coins:duo:' || q.id || ':' || v_me)
  on conflict (idempotency_key) do nothing
  returning id into v_id;
  if q.inviter = v_me then
    update public.duo_quests set inviter_claimed_at = coalesce(inviter_claimed_at, now()) where id = q.id;
  else
    update public.duo_quests set partner_claimed_at = coalesce(partner_claimed_at, now()) where id = q.id;
  end if;
  return jsonb_build_object(
    'claimed', v_id is not null,
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_me)
  );
end;
$$;

revoke execute on function public.duo_done(uuid, date, text, integer) from public, anon, authenticated;
revoke execute on function public.duo_reward(integer) from public, anon;
grant execute on function public.duo_reward(integer) to authenticated;
revoke execute on function public.my_duo_quests() from public, anon;
revoke execute on function public.create_duo_quest(uuid, text, integer) from public, anon;
revoke execute on function public.respond_duo_quest(uuid, boolean) from public, anon;
revoke execute on function public.cancel_duo_quest(uuid) from public, anon;
revoke execute on function public.claim_duo_quest(uuid) from public, anon;
grant execute on function public.my_duo_quests() to authenticated;
grant execute on function public.create_duo_quest(uuid, text, integer) to authenticated;
grant execute on function public.respond_duo_quest(uuid, boolean) to authenticated;
grant execute on function public.cancel_duo_quest(uuid) to authenticated;
grant execute on function public.claim_duo_quest(uuid) to authenticated;

-- Exportação dos dados (LGPD): passa a incluir as missões em equipe e as vitórias do Lorde do mês.
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
      from public.groups g join public.group_members m on m.group_id = g.id and m.user_id = v_user), '[]'::jsonb),
    'duo_quests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'outro_usuario', case when q.inviter = v_user then q.partner else q.inviter end,
        'convidei', q.inviter = v_user,
        'semana', q.week_start, 'area', q.category, 'meta', q.target, 'status', q.status,
        'resgatei_em', case when q.inviter = v_user then q.inviter_claimed_at else q.partner_claimed_at end,
        'criado_em', q.created_at))
      from public.duo_quests q where v_user in (q.inviter, q.partner)), '[]'::jsonb)
  );
  return v_out;
end;
$$;
