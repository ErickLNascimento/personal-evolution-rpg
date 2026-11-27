-- Push de verdade (espelha packages/domain/src/push.ts; plano em docs/push/README.md).
--   · O app registra o aparelho (register_push_token) e a pessoa escolhe as categorias
--     (set_push_settings): social, bosses (chefes e eventos) e reengage (reengajamento).
--   · Os avisos entram numa fila (push_outbox), cada um com uma chave única (nunca chega duas vezes):
--     os sociais por gatilho, na hora; os de hora marcada pela varredura push_enqueue_scheduled.
--   · A Edge Function push-dispatch (a cada 5 min, pelo pg_cron) pega o lote pronto com
--     push_claim_batch (silêncio das 22h às 8h no fuso da pessoa, no máximo 3 de chefes +
--     reengajamento por dia, preferências, descarta o que tem mais de 2 dias), envia pela API do
--     Expo e devolve o resultado com push_report (apaga aparelhos que saíram).
--   · Feature flag: app_settings.feature_push (começa desligada). Desligada, nada entra na fila,
--     push_claim_batch não devolve nada e register_push_token, unregister_push_token e
--     set_push_settings recusam com PR050. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_push';
-- Erros: 22023 token, plataforma ou idioma inválido.

insert into public.app_settings (key, value) values ('feature_push', 0);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "push_tokens: ler os meus" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

create table public.push_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  social boolean not null default true,
  bosses boolean not null default true,
  reengage boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.push_settings enable row level security;
create policy "push_settings: ler as minhas" on public.push_settings
  for select to authenticated using (user_id = auth.uid());
revoke all on public.push_settings from anon, authenticated;
grant select on public.push_settings to authenticated;

-- Fila de avisos: só o servidor lê e grava.
create table public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('social', 'bosses', 'reengage')),
  dedupe_key text not null unique,
  title_pt text not null,
  body_pt text not null,
  title_en text not null,
  body_en text not null,
  route text,
  send_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped')),
  reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_outbox_due_idx on public.push_outbox (status, send_after);
create index push_outbox_user_idx on public.push_outbox (user_id, status, sent_at);
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

-- Recibos a conferir (o Expo guarda por 24 h; conferimos depois de 15 min).
create table public.push_tickets (
  ticket_id text primary key,
  token text not null,
  created_at timestamptz not null default now()
);
alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from anon, authenticated;

-- ── Textos ──────────────────────────────────────────────────

create or replace function public.boss_display_name(p_id text, p_en boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_en then
    case p_id
      when 'golem' then 'Golem of Sloth' when 'hidra' then 'Hydra of Distraction'
      when 'lich' then 'Lich of Procrastination' when 'dragao' then 'Dragon of Fatigue'
      when 'sombra' then 'Shadow of Doubt' when 'basilisco' then 'Screen Basilisk'
      when 'kraken' then 'Kraken of Perfectionism' when 'quimera' then 'Chimera of Comparison'
      when 'banshee' then 'Banshee of Guilt' when 'vampiro' then 'Vampire of Insomnia'
      when 'mimico' then 'Mimic of Excuses' when 'medusa' then 'Medusa of Spending'
      when 'goblin' then 'Goblin of Lateness' when 'slime' then 'Slime of Clutter'
      when 'morcego' then 'Bat of the Small Hours' when 'diabrete' then 'Imp of the Phone'
      when 'esqueleto' then 'Skeleton of "Later"' else p_id end
  else
    case p_id
      when 'golem' then 'Golem da Preguiça' when 'hidra' then 'Hidra da Distração'
      when 'lich' then 'Lich da Procrastinação' when 'dragao' then 'Dragão do Cansaço'
      when 'sombra' then 'Sombra da Dúvida' when 'basilisco' then 'Basilisco da Tela'
      when 'kraken' then 'Kraken do Perfeccionismo' when 'quimera' then 'Quimera da Comparação'
      when 'banshee' then 'Banshee da Culpa' when 'vampiro' then 'Vampiro da Insônia'
      when 'mimico' then 'Mímico das Desculpas' when 'medusa' then 'Medusa do Gasto'
      when 'goblin' then 'Goblin do Atraso' when 'slime' then 'Slime da Bagunça'
      when 'morcego' then 'Morcego da Madrugada' when 'diabrete' then 'Diabrete do Celular'
      when 'esqueleto' then 'Esqueleto do "Depois"' else p_id end
  end
$$;

create or replace function public.push_person(p_user uuid, p_en boolean)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.display_name), ''),
                  case when p_en then 'Nameless adventurer' else 'Aventureiro sem nome' end)
  from public.profiles p where p.id = p_user
$$;

-- Põe um aviso na fila (ignora repetidos pela chave e não faz nada com a flag desligada).
create or replace function public.push_enqueue(
  p_user uuid, p_category text, p_key text,
  p_title_pt text, p_body_pt text, p_title_en text, p_body_en text,
  p_route text default null, p_send_after timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.feature_on('feature_push') then
    return;
  end if;
  insert into public.push_outbox (user_id, category, dedupe_key, title_pt, body_pt, title_en, body_en, route, send_after)
  values (p_user, p_category, p_key, p_title_pt, p_body_pt, p_title_en, p_body_en, p_route, p_send_after)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- ── Gatilhos sociais ────────────────────────────────────────

create or replace function public.push_on_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.push_enqueue(new.addressee, 'social', 'friend_req:' || new.id,
      'Convite para a Fogueira', public.push_person(new.requester, false) || ' quer ser seu companheiro de jornada.',
      'Campfire invite', public.push_person(new.requester, true) || ' wants to join you on your journey.',
      '/social');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.push_enqueue(new.requester, 'social', 'friend_ok:' || new.id,
      'Convite aceito', public.push_person(new.addressee, false) || ' aceitou seu convite. Agora vocês são companheiros!',
      'Invite accepted', public.push_person(new.addressee, true) || ' accepted your invite. You are now companions!',
      '/social');
  end if;
  return null;
end;
$$;

create trigger friendships_push after insert or update of status on public.friendships
  for each row execute function public.push_on_friendship();

create or replace function public.push_on_duo_quest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.push_enqueue(new.partner, 'social', 'duo_inv:' || new.id,
      'Missão em equipe', public.push_person(new.inviter, false) || ' te chamou para uma missão em equipe nesta semana.',
      'Team quest', public.push_person(new.inviter, true) || ' invited you to a team quest this week.',
      '/social');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.push_enqueue(new.inviter, 'social', 'duo_ok:' || new.id,
      'Missão em equipe aceita', public.push_person(new.partner, false) || ' topou a missão em equipe. Bora!',
      'Team quest accepted', public.push_person(new.partner, true) || ' joined your team quest. Let''s go!',
      '/social');
  end if;
  return null;
end;
$$;

create trigger duo_quests_push after insert or update of status on public.duo_quests
  for each row execute function public.push_on_duo_quest();

-- ── Varredura (hora marcada) ────────────────────────────────
-- Para cada pessoa com aparelho registrado, no fuso dela. `p_now` existe para os testes.

create or replace function public.push_enqueue_scheduled(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
  v_local timestamp;
  v_today date;
  v_hour integer;
  v_week date;
  v_month date;
  v_boss text;
  s record;
  a record;
  q record;
  g record;
  v_before integer;
  v_after integer;
  v_last date;
begin
  if not public.feature_on('feature_push') then
    return 0;
  end if;
  select count(*) into v_before from public.push_outbox;
  for u in
    select p.id, p.timezone,
           coalesce(ps.social, true) as social, coalesce(ps.bosses, true) as bosses,
           coalesce(ps.reengage, true) as reengage
    from public.profiles p
    left join public.push_settings ps on ps.user_id = p.id
    where exists (select 1 from public.push_tokens t where t.user_id = p.id)
  loop
    v_local := p_now at time zone u.timezone;
    v_today := v_local::date;
    v_hour := extract(hour from v_local)::integer;
    v_week := date_trunc('week', v_today)::date;
    v_month := date_trunc('month', v_today)::date;
    continue when v_hour >= 22 or v_hour < 8;

    -- Chefes e eventos (fora das férias)
    if u.bosses and public.feature_on('feature_challenges', 1)
       and not public.on_vacation(u.id, v_today)
       and exists (select 1 from public.habits h where h.user_id = u.id) then
      v_boss := public.boss_for_week(v_week);
      if extract(isodow from v_today) = 1 then
        perform public.push_enqueue(u.id, 'bosses', 'boss_new:' || v_week || ':' || u.id,
          'Novo chefe da semana', public.boss_display_name(v_boss, false) || ' apareceu. Cada missão feita tira vida dele.',
          'New weekly boss', public.boss_display_name(v_boss, true) || ' has appeared. Every mission you do takes away its HP.',
          '/challenges', p_now);
      end if;
      if v_hour >= 19 then
        select * into s from public.weekly_boss_status(u.id, v_week);
        if s.max_hp > 0 and s.damage >= s.max_hp
           and not exists (select 1 from public.boss_victories v where v.user_id = u.id and v.week_start = v_week) then
          perform public.push_enqueue(u.id, 'bosses', 'boss_prize:' || v_week || ':' || u.id,
            'Chefe derrotado!', public.boss_display_name(v_boss, false) || ' caiu. Seu prêmio está esperando em Desafios.',
            'Boss defeated!', public.boss_display_name(v_boss, true) || ' is down. Your reward is waiting in Challenges.',
            '/challenges', p_now);
        end if;
      end if;
      if public.feature_on('feature_ambush') then
        for a in select * from public.ambush_for_week(u.id, v_week) x where x.start_date = v_today loop
          perform public.push_enqueue(u.id, 'bosses', 'ambush:' || a.start_date || ':' || u.id,
            'Emboscada!', public.boss_display_name(a.ambusher, false) || ' apareceu por 2 dias. Vença o desafio e ganhe Cristais.',
            'Ambush!', public.boss_display_name(a.ambusher, true) || ' showed up for 2 days. Beat the challenge to earn Crystals.',
            '/', p_now);
        end loop;
      end if;
      if public.feature_on('feature_monthly_boss') and v_hour >= 18
         and v_today = (v_month + interval '1 month' - interval '1 day')::date then
        select * into s from public.monthly_boss_status(u.id, v_month);
        if s.max_hp > 0 and s.damage < s.max_hp then
          v_boss := public.monthly_boss_for(v_month);
          perform public.push_enqueue(u.id, 'bosses', 'lord_last:' || v_month || ':' || u.id,
            'Último dia do Lorde do mês', 'Faltam ' || (s.max_hp - s.damage) || ' golpes para derrubar ' || public.boss_display_name(v_boss, false) || '.',
            'Last day for the Lord of the month', (s.max_hp - s.damage) || ' hits left to bring down ' || public.boss_display_name(v_boss, true) || '.',
            '/challenges', p_now);
        end if;
      end if;
    end if;

    -- Social: prêmios de dupla e de bando esperando
    if u.social then
      if public.feature_on('feature_duo_quests') then
        for q in
          select d.id, case when d.inviter = u.id then d.partner else d.inviter end as other,
                 d.week_start, d.category, d.target
          from public.duo_quests d
          where u.id in (d.inviter, d.partner) and d.status = 'active'
            and d.week_start between v_week - 7 and v_week
            and (case when d.inviter = u.id then d.inviter_claimed_at else d.partner_claimed_at end) is null
        loop
          if public.duo_done(u.id, q.week_start, q.category, q.target) >= q.target
             and public.duo_done(q.other, q.week_start, q.category, q.target) >= q.target then
            perform public.push_enqueue(u.id, 'social', 'duo_done:' || q.id || ':' || u.id,
              'Missão em equipe cumprida!', 'Você e ' || public.push_person(q.other, false) || ' bateram a meta. Resgate ' || public.duo_reward(q.target) || ' Cristais na Fogueira.',
              'Team quest complete!', 'You and ' || public.push_person(q.other, true) || ' reached the goal. Claim ' || public.duo_reward(q.target) || ' Crystals at the Campfire.',
              '/social', p_now);
          end if;
        end loop;
      end if;
      if public.feature_on('feature_social', 1) then
        for g in select m.group_id from public.group_members m where m.user_id = u.id loop
          select * into s from public.group_boss_status(g.group_id, v_week);
          if s.max_hp > 0 and s.damage >= s.max_hp
             and not exists (select 1 from public.coin_transactions c
                             where c.idempotency_key = 'coins:group-boss:' || g.group_id || ':' || u.id || ':' || v_week) then
            perform public.push_enqueue(u.id, 'social', 'group_boss:' || g.group_id || ':' || v_week || ':' || u.id,
              'O bando venceu!', 'O chefe do bando caiu. Resgate seus Cristais na Fogueira.',
              'Your party won!', 'The party boss is down. Claim your Crystals at the Campfire.',
              '/social', p_now);
          end if;
        end loop;
      end if;
    end if;

    -- Reengajamento: 3+ dias sem missão, entre 18h e 21h, no máximo 1 por semana
    if u.reengage and v_hour between 18 and 20 and not public.on_vacation(u.id, v_today)
       and exists (select 1 from public.habits h where h.user_id = u.id) then
      select max(l.local_date) into v_last from public.habit_logs l where l.user_id = u.id;
      if v_last is not null and v_last <= v_today - 3 then
        perform public.push_enqueue(u.id, 'reengage', 'reengage:' || v_week || ':' || u.id,
          'Seu herói sente sua falta', 'Uma missão hoje já recomeça a sua jornada.',
          'Your hero misses you', 'One mission today gets your journey going again.',
          '/', p_now);
      end if;
    end if;
  end loop;
  select count(*) into v_after from public.push_outbox;
  return v_after - v_before;
end;
$$;

-- ── Envio ───────────────────────────────────────────────────

-- Lote pronto para enviar: aplica preferências, aparelho, idade, silêncio e limite do dia. Marca
-- cada aviso aceito como 'sending' e devolve uma linha por aparelho, no idioma do aparelho.
create or replace function public.push_claim_batch(p_limit integer default 300, p_now timestamptz default now())
returns table (outbox_id bigint, token text, title text, body text, route text, category text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  o record;
  v_tz text;
  v_local timestamp;
  v_hour integer;
  v_enabled boolean;
  v_capped integer;
begin
  if not public.feature_on('feature_push') then
    return;
  end if;
  for o in
    select * from public.push_outbox x
    where x.status = 'pending' and x.send_after <= p_now
    order by x.id
    limit p_limit
    for update skip locked
  loop
    select coalesce(case o.category when 'social' then ps.social when 'bosses' then ps.bosses else ps.reengage end, true)
      into v_enabled
      from public.profiles p left join public.push_settings ps on ps.user_id = p.id
      where p.id = o.user_id;
    if not coalesce(v_enabled, true) then
      update public.push_outbox set status = 'skipped', reason = 'prefs' where id = o.id;
      continue;
    end if;
    if not exists (select 1 from public.push_tokens t where t.user_id = o.user_id) then
      update public.push_outbox set status = 'skipped', reason = 'no_token' where id = o.id;
      continue;
    end if;
    if o.created_at < p_now - interval '2 days' then
      update public.push_outbox set status = 'skipped', reason = 'stale' where id = o.id;
      continue;
    end if;
    select p.timezone into v_tz from public.profiles p where p.id = o.user_id;
    v_local := p_now at time zone v_tz;
    v_hour := extract(hour from v_local)::integer;
    if v_hour >= 22 or v_hour < 8 then
      -- Silêncio: espera até as 8h (hora da pessoa).
      update public.push_outbox
      set send_after = ((v_local::date + case when v_hour >= 22 then 1 else 0 end) + time '08:00') at time zone v_tz
      where id = o.id;
      continue;
    end if;
    if o.category <> 'social' then
      select count(*) into v_capped from public.push_outbox x
      where x.user_id = o.user_id and x.category <> 'social' and x.status in ('sending', 'sent')
        and (coalesce(x.sent_at, p_now) at time zone v_tz)::date = v_local::date;
      if v_capped >= 3 then
        update public.push_outbox set status = 'skipped', reason = 'cap' where id = o.id;
        continue;
      end if;
    end if;
    update public.push_outbox set status = 'sending', sent_at = p_now where id = o.id;
    return query
      select o.id, t.token,
             case when t.locale = 'en' then o.title_en else o.title_pt end,
             case when t.locale = 'en' then o.body_en else o.body_pt end,
             o.route, o.category
      from public.push_tokens t where t.user_id = o.user_id;
  end loop;
end;
$$;

-- Resultado do envio: avisos enviados, recibos a conferir, recibos já conferidos e aparelhos que
-- saíram (DeviceNotRegistered). Avisos 'sending' que ficaram para trás voltam para a fila.
create or replace function public.push_report(
  p_sent bigint[] default '{}', p_tickets jsonb default '[]', p_done_tickets text[] default '{}',
  p_bad_tokens text[] default '{}', p_failed bigint[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_outbox set status = 'sent' where id = any (p_sent);
  update public.push_outbox set status = 'pending', sent_at = null where id = any (p_failed);
  insert into public.push_tickets (ticket_id, token)
  select x->>'ticket_id', x->>'token' from jsonb_array_elements(p_tickets) x
  on conflict do nothing;
  delete from public.push_tickets where ticket_id = any (p_done_tickets);
  -- O Expo guarda recibos por 24 h: depois disso não há o que conferir.
  delete from public.push_tickets where created_at < now() - interval '1 day';
  delete from public.push_tokens where token = any (p_bad_tokens);
  -- Travados há mais de 30 min (a função caiu no meio do envio): tenta de novo.
  update public.push_outbox set status = 'pending', sent_at = null
  where status = 'sending' and sent_at < now() - interval '30 minutes';
end;
$$;

-- Recibos com mais de 15 min, para conferir (até 1000 por vez, o limite do Expo).
create or replace function public.push_tickets_due()
returns table (ticket_id text, token text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.ticket_id, t.token from public.push_tickets t
  where t.created_at < now() - interval '15 minutes'
  order by t.created_at limit 1000
$$;

-- ── Funções do app ──────────────────────────────────────────

create or replace function public.register_push_token(p_token text, p_platform text, p_locale text default 'pt-BR')
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
  perform public.require_feature('feature_push');
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then
    raise exception 'Token de push inválido' using errcode = '22023';
  end if;
  if p_platform not in ('android', 'ios') or p_locale not in ('pt-BR', 'en') then
    raise exception 'Plataforma ou idioma inválido' using errcode = '22023';
  end if;
  -- O mesmo aparelho pode trocar de conta: o token passa para quem entrou.
  insert into public.push_tokens (token, user_id, platform, locale)
  values (p_token, v_me, p_platform, p_locale)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, locale = excluded.locale, last_seen_at = now();
  insert into public.push_settings (user_id) values (v_me) on conflict do nothing;
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_push');
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

create or replace function public.set_push_settings(p_social boolean, p_bosses boolean, p_reengage boolean)
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
  perform public.require_feature('feature_push');
  insert into public.push_settings (user_id, social, bosses, reengage, updated_at)
  values (v_me, coalesce(p_social, true), coalesce(p_bosses, true), coalesce(p_reengage, true), now())
  on conflict (user_id) do update
    set social = excluded.social, bosses = excluded.bosses, reengage = excluded.reengage, updated_at = now();
end;
$$;

revoke execute on function public.boss_display_name(text, boolean) from public, anon, authenticated;
revoke execute on function public.push_person(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.push_enqueue(uuid, text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.push_on_friendship() from public, anon, authenticated;
revoke execute on function public.push_on_duo_quest() from public, anon, authenticated;
revoke execute on function public.push_enqueue_scheduled(timestamptz) from public, anon, authenticated;
revoke execute on function public.push_claim_batch(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.push_report(bigint[], jsonb, text[], text[], bigint[]) from public, anon, authenticated;
revoke execute on function public.push_tickets_due() from public, anon, authenticated;
grant execute on function public.push_enqueue_scheduled(timestamptz) to service_role;
grant execute on function public.push_claim_batch(integer, timestamptz) to service_role;
grant execute on function public.push_report(bigint[], jsonb, text[], text[], bigint[]) to service_role;
grant execute on function public.push_tickets_due() to service_role;
revoke execute on function public.register_push_token(text, text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
revoke execute on function public.set_push_settings(boolean, boolean, boolean) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.set_push_settings(boolean, boolean, boolean) to authenticated;

-- Exportação dos dados (LGPD): passa a incluir os aparelhos registrados e as preferências de aviso.
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
    'mood_entries', 'feedback', 'group_members', 'vacations', 'boss_victories', 'ambush_victories', 'monthly_boss_victories',
    'push_tokens', 'push_settings'
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
