-- Social: amigos e grupos (espelha packages/domain/src/social.ts).
--   · Amigos e colegas de grupo veem só o RESUMO: herói, nível, streak e missões feitas hoje
--     (ex.: 3/5). Nomes de hábitos e registros continuam visíveis só para o dono (RLS intacto):
--     o resumo sai de funções security definer que devolvem apenas esses números.
--   · Adicionar: código de amigo (6 letras, ex.: K7Q2PM) ou busca por nome (quem desligar
--     `discoverable` some da busca). A amizade só vale depois que o outro aceita.
--   · Grupos de até 6 pessoas enfrentam juntos o chefe da semana: vida = 80% das missões
--     agendadas de todos; cada missão feita por qualquer membro tira 1. Derrotado, cada
--     membro resgata Cristais (coins:group-boss:<grupo>:<usuário>:<segunda>).
-- Tudo que grava passa por RPC; o app só lê as próprias amizades e grupos.

-- ─────────────────────────────────────────────────────────────
-- Códigos (amigo e convite de grupo)
-- ─────────────────────────────────────────────────────────────
create or replace function public.gen_social_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '')
  from generate_series(1, 6)
$$;

alter table public.profiles
  add column friend_code text unique default public.gen_social_code(),
  add column discoverable boolean not null default true;

update public.profiles set friend_code = public.gen_social_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;

-- O código de amigo não é editável pelo app.
create or replace function public.profiles_guard_friend_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.friend_code is distinct from old.friend_code then
    raise exception 'O código de amigo não pode ser alterado' using errcode = 'PR045';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_friend_code before update of friend_code on public.profiles
  for each row execute function public.profiles_guard_friend_code();

-- ─────────────────────────────────────────────────────────────
-- Resumo público de um usuário
-- ─────────────────────────────────────────────────────────────

-- Streak atual com as mesmas regras do app (computeStreak + streakFrom, janela de 90 dias):
-- hoje e ontem em aberto, 1 falta perdoada por semana, dias com escudo não quebram.
create or replace function public.user_streak(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.user_today(p_user);
  v_first date;
  v_from date;
  d date;
  v_total integer;
  v_current integer := 0;
  v_week date;
  v_week_used integer := 0;
begin
  select min(start_date) into v_first from public.habits where user_id = p_user;
  if v_first is null or v_first > v_today then
    return 0;
  end if;
  v_from := greatest(v_first, v_today - 89);

  d := v_today;
  while d >= v_from loop
    select count(*) into v_total from public.habits h
    where h.user_id = p_user and public.habit_scheduled_on(h, d);

    if v_total > 0 then
      if public.pending_scheduled_count(p_user, d) = 0 then
        v_current := v_current + 1;
      elsif d >= v_today - 1 then
        null; -- ainda dá para registrar
      elsif exists (select 1 from public.streak_shield_uses s where s.user_id = p_user and s.local_date = d) then
        null; -- escudo
      else
        if v_week is distinct from date_trunc('week', d)::date then
          v_week := date_trunc('week', d)::date;
          v_week_used := 0;
        end if;
        if v_week_used < 1 then
          v_week_used := v_week_used + 1; -- falta perdoada da semana
        else
          exit;
        end if;
      end if;
    end if;
    d := d - 1;
  end loop;

  return v_current;
end;
$$;

create or replace function public.social_summary(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'hero', p.hero,
    'race', p.race,
    'path', p.path,
    'branch', p.branch,
    'stage', p.stage,
    'cosmetics', coalesce((select jsonb_agg(c.item_id) from public.user_cosmetics c where c.user_id = p.id), '[]'::jsonb),
    'level', public.level_from_xp((select coalesce(sum(amount), 0)::integer from public.xp_transactions x where x.user_id = p.id)),
    'streak', public.user_streak(p.id),
    'today_total', (select count(*) from public.habits h
                    where h.user_id = p.id and public.habit_scheduled_on(h, public.user_today(p.id))),
    'today_done', (select count(*) from public.habits h
                   where h.user_id = p.id and public.habit_scheduled_on(h, public.user_today(p.id))
                     and exists (select 1 from public.habit_logs l
                                 where l.habit_id = h.id and l.local_date = public.user_today(p.id)))
  )
  from public.profiles p
  where p.id = p_user
$$;

-- Versão curta para quem ainda não é amigo (busca e pedidos): só nome, nível e aparência.
create or replace function public.social_card(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'hero', p.hero,
    'race', p.race,
    'path', p.path,
    'branch', p.branch,
    'stage', p.stage,
    'cosmetics', coalesce((select jsonb_agg(c.item_id) from public.user_cosmetics c where c.user_id = p.id), '[]'::jsonb),
    'level', public.level_from_xp((select coalesce(sum(amount), 0)::integer from public.xp_transactions x where x.user_id = p.id))
  )
  from public.profiles p
  where p.id = p_user
$$;

-- ─────────────────────────────────────────────────────────────
-- Amizades
-- ─────────────────────────────────────────────────────────────
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester <> addressee)
);

-- Uma relação por par, em qualquer direção.
create unique index friendships_pair on public.friendships
  (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;
create policy "friendships: ler as próprias" on public.friendships
  for select to authenticated using (requester = auth.uid() or addressee = auth.uid());
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  )
$$;

-- Pede amizade pelo código ou pelo id (vindo da busca). Se o outro já tinha pedido, aceita.
create or replace function public.send_friend_request(p_code text default null, p_user uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_existing public.friendships%rowtype;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  if p_code is not null then
    select id into v_target from public.profiles where friend_code = upper(replace(p_code, '-', ''));
  elsif p_user is not null then
    -- pela busca: só quem aparece nela
    select id into v_target from public.profiles where id = p_user and discoverable;
  end if;
  if v_target is null then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
  if v_target = v_me then
    raise exception 'Este é o seu próprio código' using errcode = 'PR040';
  end if;

  perform pg_advisory_xact_lock(hashtext('friend:' || least(v_me, v_target)::text || greatest(v_me, v_target)::text));

  select * into v_existing from public.friendships
  where least(requester, addressee) = least(v_me, v_target)
    and greatest(requester, addressee) = greatest(v_me, v_target);

  if found then
    if v_existing.status = 'accepted' then
      raise exception 'Vocês já são amigos' using errcode = 'PR041';
    end if;
    if v_existing.addressee = v_me then
      update public.friendships set status = 'accepted', accepted_at = now() where id = v_existing.id;
      return jsonb_build_object('status', 'accepted', 'user', public.social_card(v_target));
    end if;
    return jsonb_build_object('status', 'pending', 'user', public.social_card(v_target));
  end if;

  if (select count(*) from public.friendships
      where (requester = v_me or addressee = v_me) and status = 'accepted') >= 100 then
    raise exception 'Limite de amigos' using errcode = 'PR042';
  end if;
  if (select count(*) from public.friendships where requester = v_me and status = 'pending') >= 50 then
    raise exception 'Muitos pedidos pendentes' using errcode = 'PR042';
  end if;

  insert into public.friendships (requester, addressee) values (v_me, v_target);
  return jsonb_build_object('status', 'pending', 'user', public.social_card(v_target));
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where id = p_request_id and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where id = p_request_id and addressee = auth.uid() and status = 'pending';
  end if;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- Desfaz a amizade ou cancela um pedido, em qualquer direção.
create or replace function public.remove_friend(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  delete from public.friendships
  where least(requester, addressee) = least(auth.uid(), p_user)
    and greatest(requester, addressee) = greatest(auth.uid(), p_user);
  if not found then
    raise exception 'Amizade não encontrada' using errcode = 'P0002';
  end if;
end;
$$;

-- Amigos (com resumo), pedidos recebidos e enviados (com cartão curto).
create or replace function public.my_friends()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(public.social_summary(case when f.requester = v_me then f.addressee else f.requester end)
                       order by f.accepted_at)
      from public.friendships f
      where f.status = 'accepted' and (f.requester = v_me or f.addressee = v_me)), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('request_id', f.id, 'user', public.social_card(f.requester)) order by f.created_at)
      from public.friendships f where f.status = 'pending' and f.addressee = v_me), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('request_id', f.id, 'user', public.social_card(f.addressee)) order by f.created_at)
      from public.friendships f where f.status = 'pending' and f.requester = v_me), '[]'::jsonb)
  );
end;
$$;

-- Busca por nome (só quem deixou a busca ligada). Devolve o cartão curto e a relação atual.
create or replace function public.search_users(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_q text := btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if char_length(v_q) < 2 then
    raise exception 'Digite ao menos 2 letras' using errcode = '22023';
  end if;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user', public.social_card(p.id),
      'relation', (select case
                     when f.status = 'accepted' then 'friend'
                     when f.requester = v_me then 'pending_out'
                     else 'pending_in' end
                   from public.friendships f
                   where least(f.requester, f.addressee) = least(v_me, p.id)
                     and greatest(f.requester, f.addressee) = greatest(v_me, p.id))
    ) order by p.display_name)
    from (
      select id, display_name from public.profiles
      where discoverable and id <> v_me and display_name ilike '%' || v_q || '%'
      order by display_name
      limit 20
    ) p
  ), '[]'::jsonb);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Grupos
-- ─────────────────────────────────────────────────────────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  owner uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique default public.gen_social_code(),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = p_user)
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy "groups: membros leem" on public.groups
  for select to authenticated using (public.is_group_member(id, auth.uid()));
create policy "group_members: membros leem" on public.group_members
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));
revoke all on public.groups, public.group_members from anon, authenticated;
grant select on public.groups, public.group_members to authenticated;

insert into public.coin_rules (key, amount) values ('coin_group_boss', 30);

create or replace function public.create_group(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'Nome inválido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('groups:' || v_me::text));
  if (select count(*) from public.group_members where user_id = v_me) >= 5 then
    raise exception 'Limite de grupos' using errcode = 'PR043';
  end if;
  insert into public.groups (name, owner) values (v_name, v_me) returning id into v_id;
  insert into public.group_members (group_id, user_id) values (v_id, v_me);
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.join_group(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_group public.groups%rowtype;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into v_group from public.groups where invite_code = upper(replace(coalesce(p_code, ''), '-', ''));
  if not found then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('group:' || v_group.id::text));
  if public.is_group_member(v_group.id, v_me) then
    return jsonb_build_object('id', v_group.id);
  end if;
  if (select count(*) from public.group_members where group_id = v_group.id) >= 6 then
    raise exception 'Grupo cheio' using errcode = 'PR044';
  end if;
  if (select count(*) from public.group_members where user_id = v_me) >= 5 then
    raise exception 'Limite de grupos' using errcode = 'PR043';
  end if;
  insert into public.group_members (group_id, user_id) values (v_group.id, v_me);
  return jsonb_build_object('id', v_group.id);
end;
$$;

-- Sai do grupo. O dono passa a ser o membro mais antigo; sem ninguém, o grupo é apagado.
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_next uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('group:' || p_group::text));
  delete from public.group_members where group_id = p_group and user_id = v_me;
  if not found then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;
  select user_id into v_next from public.group_members where group_id = p_group order by joined_at limit 1;
  if v_next is null then
    delete from public.groups where id = p_group;
  else
    update public.groups set owner = v_next where id = p_group and owner = v_me;
  end if;
end;
$$;

-- Chefe do grupo: soma as missões de todos os membros na semana.
create or replace function public.group_boss_status(p_group uuid, p_week_start date)
returns table (max_hp integer, damage integer)
language sql
stable
security definer
set search_path = ''
as $$
  with slots as (
    select h.id, d::date as day
    from public.group_members m
    join public.habits h on h.user_id = m.user_id
    cross join generate_series(p_week_start, p_week_start + 6, interval '1 day') d
    where m.group_id = p_group and public.habit_scheduled_on(h, d::date)
  )
  select ceil(count(*) * 80 / 100.0)::integer,
         count(*) filter (where exists (select 1 from public.habit_logs l
                                        where l.habit_id = s.id and l.local_date = s.day))::integer
  from slots s
$$;

create or replace function public.group_json(p_group uuid, p_me uuid, p_with_members boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
  v_week date := date_trunc('week', public.user_today(p_me))::date;
  v_this record;
  v_last record;
begin
  select * into v_group from public.groups where id = p_group;
  select * into v_this from public.group_boss_status(p_group, v_week);
  select * into v_last from public.group_boss_status(p_group, v_week - 7);
  return jsonb_build_object(
    'id', v_group.id,
    'name', v_group.name,
    'invite_code', v_group.invite_code,
    'is_owner', v_group.owner = p_me,
    'member_count', (select count(*) from public.group_members where group_id = p_group),
    'week_start', v_week,
    'boss', jsonb_build_object('max_hp', v_this.max_hp, 'damage', v_this.damage,
      'claimed', exists (select 1 from public.coin_transactions t where t.user_id = p_me
                         and t.item_id = 'group-boss:' || p_group || ':' || v_week)),
    'last_boss', jsonb_build_object('max_hp', v_last.max_hp, 'damage', v_last.damage,
      'claimed', exists (select 1 from public.coin_transactions t where t.user_id = p_me
                         and t.item_id = 'group-boss:' || p_group || ':' || (v_week - 7))),
    'members', case when p_with_members then coalesce((
      select jsonb_agg(public.social_summary(m.user_id) order by m.joined_at)
      from public.group_members m where m.group_id = p_group), '[]'::jsonb) else null end
  );
end;
$$;

create or replace function public.my_groups()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.group_json(m.group_id, auth.uid(), false) order by m.joined_at)
    from public.group_members m where m.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.group_detail(p_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group, auth.uid()) then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;
  return public.group_json(p_group, auth.uid(), true);
end;
$$;

create or replace function public.claim_group_boss(p_group uuid, p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_this_week date;
  v_s record;
  v_amount integer;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if not public.is_group_member(p_group, v_me) then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;
  v_this_week := date_trunc('week', public.user_today(v_me))::date;
  if p_week_start not in (v_this_week, v_this_week - 7) then
    raise exception 'Só dá para resgatar o chefe desta semana ou da anterior' using errcode = '22023';
  end if;
  select * into v_s from public.group_boss_status(p_group, p_week_start);
  if v_s.max_hp = 0 or v_s.damage < v_s.max_hp then
    raise exception 'O chefe ainda não foi derrotado' using errcode = 'PR032';
  end if;

  select amount into v_amount from public.coin_rules where key = 'coin_group_boss';
  v_amount := coalesce(v_amount, 0);
  if v_amount > 0 then
    insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
    values (v_me, v_amount, 'challenge', 'group-boss:' || p_group || ':' || p_week_start, public.user_today(v_me),
            'coins:group-boss:' || p_group || ':' || v_me || ':' || p_week_start)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'claimed', v_id is not null,
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_me)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Permissões: internas fechadas; RPCs só para autenticados
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.gen_social_code() from public, anon, authenticated;
revoke execute on function public.user_streak(uuid) from public, anon, authenticated;
revoke execute on function public.social_summary(uuid) from public, anon, authenticated;
revoke execute on function public.social_card(uuid) from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.group_boss_status(uuid, date) from public, anon, authenticated;
revoke execute on function public.group_json(uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon;

revoke execute on function public.send_friend_request(text, uuid) from public, anon;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
revoke execute on function public.my_friends() from public, anon;
revoke execute on function public.search_users(text) from public, anon;
revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.join_group(text) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.my_groups() from public, anon;
revoke execute on function public.group_detail(uuid) from public, anon;
revoke execute on function public.claim_group_boss(uuid, date) from public, anon;

grant execute on function public.is_group_member(uuid, uuid) to authenticated; -- usada nas políticas
grant execute on function public.send_friend_request(text, uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.search_users(text) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.group_detail(uuid) to authenticated;
grant execute on function public.claim_group_boss(uuid, date) to authenticated;
