-- Cristais: segunda moeda do jogo. Concedidos SÓ por log_habit (missão, dia perfeito, subida de
-- nível) e gastos SÓ por buy_item (classes da loja). O app e a IA nunca inserem em coin_transactions.
-- O XP não muda: log_habit / undo_habit_log continuam concedendo e estornando XP como antes.
--
-- Chaves de idempotência dos Cristais:
--   coins:habit-log:<log_id>                    missão
--   coins:perfect-day:<user>:<data>:<ocorrência> dia perfeito (acompanha o bônus de XP)
--   coins:level-up:<user>:<nível>               subida de nível (uma vez por nível, nunca estornada)
--   purchase:<user>:<item>                      compra
--   reversal:<chave original>                   estorno ao desfazer

-- ─────────────────────────────────────────────────────────────
-- Regras e catálogo (editáveis só pelo backend; o app lê)
-- ─────────────────────────────────────────────────────────────
create table public.coin_rules (
  key text primary key,
  amount integer not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

insert into public.coin_rules (key, amount) values
  ('coin_easy', 5),
  ('coin_medium', 10),
  ('coin_hard', 15),
  ('coin_perfect_day', 15),
  ('coin_level_up_per_level', 10);

-- Classes do herói: requisito, preço e bônus de Cristais. Preço 0 = classe inicial (grátis).
create table public.class_catalog (
  id text primary key,
  tier smallint not null check (tier between 1 and 6),
  min_level integer not null default 1 check (min_level >= 1),
  price integer not null default 0 check (price >= 0),
  -- área da afinidade (categoria de objetivo) e bônus percentual nas missões dela
  area text check (area in (
    'health', 'career', 'finance', 'knowledge', 'productivity',
    'relationships', 'wellbeing', 'personal_growth'
  )),
  area_pct integer not null default 0 check (area_pct between 0 and 100),
  -- vantagens próprias
  perfect_day_extra integer not null default 0,
  easy_extra integer not null default 0,
  medium_extra integer not null default 0,
  hard_extra integer not null default 0,
  yesterday_full boolean not null default false,
  level_up_extra integer not null default 0,
  night_extra integer not null default 0
);

insert into public.class_catalog
  (id, tier, min_level, price, area, area_pct, perfect_day_extra, easy_extra, yesterday_full, night_extra) values
  ('guerreiro', 1, 1, 0, 'health', 10, 0, 0, false, 0),
  ('mago', 1, 1, 0, 'knowledge', 10, 0, 0, false, 0),
  ('arqueiro', 1, 1, 0, 'productivity', 10, 0, 0, false, 0),
  ('monge', 1, 1, 0, 'wellbeing', 10, 0, 0, false, 0),
  ('paladino', 2, 5, 300, 'personal_growth', 15, 0, 0, false, 0),
  ('ladino', 2, 5, 300, 'productivity', 15, 0, 0, true, 0),
  ('bardo', 2, 5, 300, 'relationships', 15, 5, 0, false, 0),
  ('druida', 2, 5, 300, 'wellbeing', 15, 0, 2, false, 0),
  ('necromante', 3, 10, 800, 'knowledge', 20, 0, 0, false, 3);

-- ─────────────────────────────────────────────────────────────
-- Livro de Cristais e classes adquiridas
-- ─────────────────────────────────────────────────────────────
create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  source_type text not null check (source_type in ('habit', 'perfect_day', 'level_up', 'purchase', 'reversal')),
  source_id uuid,
  item_id text,
  local_date date not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index coin_transactions_user_idx on public.coin_transactions (user_id, created_at desc);

create table public.user_unlocks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.class_catalog (id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.coin_rules enable row level security;
alter table public.class_catalog enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.user_unlocks enable row level security;

create policy "coin_rules: leitura" on public.coin_rules for select to authenticated using (true);
create policy "class_catalog: leitura" on public.class_catalog for select to authenticated using (true);
create policy "coin_transactions: ler o próprio" on public.coin_transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_unlocks: ler o próprio" on public.user_unlocks
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.coin_rules, public.class_catalog, public.coin_transactions, public.user_unlocks from anon, authenticated;
grant select on public.coin_rules, public.class_catalog, public.coin_transactions, public.user_unlocks to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Auxiliares internas
-- ─────────────────────────────────────────────────────────────

-- Mesma fórmula de packages/domain/src/level.ts: chegar ao nível n custa 50·n·(n−1) XP.
create or replace function public.level_from_xp(p_xp integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_xp integer := greatest(0, coalesce(p_xp, 0));
  n integer := greatest(1, floor((1 + sqrt(1 + 0.08 * v_xp)) / 2)::integer);
begin
  while 50 * (n + 1) * n <= v_xp loop n := n + 1; end loop;
  while n > 1 and 50 * n * (n - 1) > v_xp loop n := n - 1; end loop;
  return n;
end;
$$;

-- Classe equipada que o usuário pode usar (grátis ou comprada); senão, a inicial padrão.
create or replace function public.equipped_class(p_user_id uuid)
returns public.class_catalog
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.class_catalog c
  where c.id = coalesce(
    (select cc.id
     from public.profiles p
     join public.class_catalog cc on cc.id = p.hero ->> 'heroClass'
     where p.id = p_user_id
       and (cc.price = 0 or exists (
         select 1 from public.user_unlocks u where u.user_id = p_user_id and u.item_id = cc.id))),
    'guerreiro');
$$;

create or replace function public.my_coin_balance()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer
  from public.coin_transactions
  where user_id = (select auth.uid());
$$;

-- Ninguém equipa uma classe que não comprou (o perfil é editável pelo próprio usuário).
create or replace function public.profiles_guard_hero_class()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_class text := new.hero ->> 'heroClass';
begin
  if v_class is null or v_class is not distinct from (old.hero ->> 'heroClass') then
    return new;
  end if;
  if not exists (select 1 from public.class_catalog where id = v_class) then
    raise exception 'Classe desconhecida: %', v_class using errcode = '22023';
  end if;
  if exists (select 1 from public.class_catalog where id = v_class and price > 0)
     and not exists (select 1 from public.user_unlocks where user_id = new.id and item_id = v_class) then
    raise exception 'Classe ainda não adquirida: %', v_class using errcode = 'PR005';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_hero_class before update of hero on public.profiles
  for each row execute function public.profiles_guard_hero_class();

-- ─────────────────────────────────────────────────────────────
-- log_habit: igual ao anterior para o XP; agora também concede Cristais.
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_habit(
  p_habit_id uuid,
  p_local_date date,
  p_qty numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_tz text;
  v_habit public.habits%rowtype;
  v_class public.class_catalog%rowtype;
  v_log_id uuid;
  v_xp integer := 0;
  v_bonus integer := 0;
  v_occurrence integer;
  v_total_before integer;
  v_total_after integer;
  v_category text;
  v_coin integer := 0;
  v_coins_awarded integer := 0;
  v_amount integer;
  v_lvl integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_habit from public.habits where id = p_habit_id and user_id = v_user;
  if not found then
    raise exception 'Hábito não encontrado' using errcode = 'P0002';
  end if;

  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível registrar hoje ou ontem' using errcode = '22023';
  end if;

  if p_local_date < v_habit.start_date
     or (v_habit.archived_on is not null and p_local_date > v_habit.archived_on)
     or not (extract(dow from p_local_date)::smallint = any (v_habit.schedule_days)) then
    raise exception 'Hábito não agendado para esta data' using errcode = '22023';
  end if;

  -- Serializa registros do mesmo usuário no mesmo dia (bônus de dia perfeito).
  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  select coalesce(sum(amount), 0) into v_total_before from public.xp_transactions where user_id = v_user;

  insert into public.habit_logs (user_id, habit_id, local_date, qty)
  values (v_user, p_habit_id, p_local_date, p_qty)
  on conflict (habit_id, local_date) do nothing
  returning id into v_log_id;

  if v_log_id is not null then
    -- ── XP (inalterado) ──
    select amount into v_xp from public.xp_rules where key = 'habit_' || v_habit.difficulty::text;

    insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
    values (v_user, v_xp, 'habit', v_log_id, p_local_date, 'habit-log:' || v_log_id::text);

    if public.pending_scheduled_count(v_user, p_local_date) = 0
       and public.perfect_day_net(v_user, p_local_date) = 0 then
      select amount into v_bonus from public.xp_rules where key = 'perfect_day_bonus';
      if v_bonus > 0 then
        select count(*) + 1 into v_occurrence
        from public.xp_transactions
        where user_id = v_user and local_date = p_local_date and source_type = 'perfect_day';

        insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (
          v_user, v_bonus, 'perfect_day', p_local_date,
          'perfect-day:' || v_user::text || ':' || p_local_date::text || ':' || v_occurrence::text
        );
      end if;
    end if;

    -- ── Cristais da missão ──
    v_class := public.equipped_class(v_user);
    select timezone into v_tz from public.profiles where id = v_user;
    select o.category into v_category from public.objectives o where o.id = v_habit.objective_id;

    select amount into v_coin from public.coin_rules where key = 'coin_' || v_habit.difficulty::text;
    v_coin := coalesce(v_coin, 0);
    -- Missão de ontem rende metade (o Ladino recebe cheio).
    if p_local_date < v_today and not v_class.yesterday_full then
      v_coin := ceil(v_coin / 2.0)::integer;
    end if;
    -- Bônus da classe na área da afinidade (arredonda para cima).
    if v_class.area is not null and coalesce(v_category, 'personal_growth') = v_class.area then
      v_coin := v_coin + ceil(v_coin * v_class.area_pct / 100.0)::integer;
    end if;
    v_coin := v_coin + case v_habit.difficulty
      when 'easy' then v_class.easy_extra
      when 'medium' then v_class.medium_extra
      else v_class.hard_extra end;
    -- Vantagem noturna (missão de hoje concluída a partir das 20h no fuso do usuário).
    if v_class.night_extra > 0 and p_local_date = v_today
       and extract(hour from now() at time zone v_tz) >= 20 then
      v_coin := v_coin + v_class.night_extra;
    end if;

    if v_coin > 0 then
      insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
      values (v_user, v_coin, 'habit', v_log_id, p_local_date, 'coins:habit-log:' || v_log_id::text);
      v_coins_awarded := v_coins_awarded + v_coin;
    end if;

    -- ── Cristais do dia perfeito (acompanham o bônus de XP, mesma ocorrência) ──
    if v_bonus > 0 then
      select amount into v_amount from public.coin_rules where key = 'coin_perfect_day';
      v_amount := coalesce(v_amount, 0) + v_class.perfect_day_extra;
      if v_amount > 0 then
        insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (
          v_user, v_amount, 'perfect_day', p_local_date,
          'coins:perfect-day:' || v_user::text || ':' || p_local_date::text || ':' || v_occurrence::text
        );
        v_coins_awarded := v_coins_awarded + v_amount;
      end if;
    end if;

    -- ── Cristais de subida de nível (uma vez por nível na vida, nunca estornados) ──
    select coalesce(sum(amount), 0) into v_total_after from public.xp_transactions where user_id = v_user;
    select amount into v_amount from public.coin_rules where key = 'coin_level_up_per_level';
    for v_lvl in (public.level_from_xp(v_total_before) + 1)..public.level_from_xp(v_total_after) loop
      insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
      values (
        v_user, v_lvl * coalesce(v_amount, 0) + v_class.level_up_extra, 'level_up', p_local_date,
        'coins:level-up:' || v_user::text || ':' || v_lvl::text
      )
      on conflict (idempotency_key) do nothing;
      if found then
        v_coins_awarded := v_coins_awarded + v_lvl * coalesce(v_amount, 0) + v_class.level_up_extra;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'logged', v_log_id is not null,
    'xp_awarded', v_xp,
    'perfect_day_bonus', v_bonus,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user),
    'coins_awarded', v_coins_awarded,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- undo_habit_log: igual ao anterior para o XP; agora também estorna os Cristais.
-- ─────────────────────────────────────────────────────────────
create or replace function public.undo_habit_log(p_habit_id uuid, p_local_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_log_id uuid;
  v_original public.xp_transactions%rowtype;
  v_bonus public.xp_transactions%rowtype;
  v_coin public.coin_transactions%rowtype;
  v_reverted integer := 0;
  v_coins_reverted integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível desfazer hoje ou ontem' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  delete from public.habit_logs
  where habit_id = p_habit_id and local_date = p_local_date and user_id = v_user
  returning id into v_log_id;

  if v_log_id is not null then
    select * into v_original
    from public.xp_transactions
    where idempotency_key = 'habit-log:' || v_log_id::text;

    if found then
      insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
      values (v_user, -v_original.amount, 'reversal', v_log_id, p_local_date, 'reversal:' || v_original.idempotency_key)
      on conflict (idempotency_key) do nothing;
      v_reverted := v_original.amount;
    end if;

    -- Cristais da missão: estorna exatamente o que ela deu.
    select * into v_coin from public.coin_transactions where idempotency_key = 'coins:habit-log:' || v_log_id::text;
    if found then
      insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
      values (v_user, -v_coin.amount, 'reversal', v_log_id, p_local_date, 'reversal:' || v_coin.idempotency_key)
      on conflict (idempotency_key) do nothing;
      v_coins_reverted := v_coin.amount;
    end if;

    -- O dia deixou de ser perfeito: estorna o bônus ativo (XP e Cristais da mesma ocorrência).
    if public.perfect_day_net(v_user, p_local_date) > 0 then
      select * into v_bonus
      from public.xp_transactions t
      where t.user_id = v_user and t.local_date = p_local_date and t.source_type = 'perfect_day'
        and not exists (
          select 1 from public.xp_transactions r
          where r.idempotency_key = 'reversal:' || t.idempotency_key
        )
      limit 1;

      insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
      values (v_user, -v_bonus.amount, 'reversal', p_local_date, 'reversal:' || v_bonus.idempotency_key)
      on conflict (idempotency_key) do nothing;
      v_reverted := v_reverted + v_bonus.amount;

      select * into v_coin from public.coin_transactions where idempotency_key = 'coins:' || v_bonus.idempotency_key;
      if found then
        insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (v_user, -v_coin.amount, 'reversal', p_local_date, 'reversal:' || v_coin.idempotency_key)
        on conflict (idempotency_key) do nothing;
        v_coins_reverted := v_coins_reverted + v_coin.amount;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'undone', v_log_id is not null,
    'xp_reverted', v_reverted,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user),
    'coins_reverted', v_coins_reverted,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- buy_item: compra uma classe da loja (confere nível, saldo e posse) numa transação.
-- Erros: P0002 item inexistente · 22023 item grátis · PR002 já possui ·
--        PR003 nível insuficiente · PR004 Cristais insuficientes
-- ─────────────────────────────────────────────────────────────
create or replace function public.buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.class_catalog%rowtype;
  v_level integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_item from public.class_catalog where id = p_item_id;
  if not found then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;
  if v_item.price = 0 then
    raise exception 'Este item já é gratuito' using errcode = '22023';
  end if;

  -- Uma compra por vez por usuário (saldo consistente).
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':coins'));

  if exists (select 1 from public.user_unlocks where user_id = v_user and item_id = p_item_id) then
    raise exception 'Você já possui este item' using errcode = 'PR002';
  end if;

  v_level := public.level_from_xp((select coalesce(sum(amount), 0)::integer from public.xp_transactions where user_id = v_user));
  if v_level < v_item.min_level then
    raise exception 'Requer nível %', v_item.min_level using errcode = 'PR003';
  end if;

  select coalesce(sum(amount), 0) into v_balance from public.coin_transactions where user_id = v_user;
  if v_balance < v_item.price then
    raise exception 'Cristais insuficientes' using errcode = 'PR004';
  end if;

  insert into public.user_unlocks (user_id, item_id) values (v_user, p_item_id);
  insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
  values (
    v_user, -v_item.price, 'purchase', p_item_id, public.user_today(v_user),
    'purchase:' || v_user::text || ':' || p_item_id
  );

  return jsonb_build_object('item', p_item_id, 'coin_balance', v_balance - v_item.price);
end;
$$;

-- Permissões das funções
revoke execute on function public.level_from_xp(integer) from public, anon, authenticated;
revoke execute on function public.equipped_class(uuid) from public, anon, authenticated;
revoke execute on function public.profiles_guard_hero_class() from public, anon, authenticated;
revoke execute on function public.my_coin_balance() from public, anon;
revoke execute on function public.buy_item(text) from public, anon;
revoke execute on function public.log_habit(uuid, date, numeric) from public, anon;
revoke execute on function public.undo_habit_log(uuid, date) from public, anon;
grant execute on function public.my_coin_balance() to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.log_habit(uuid, date, numeric) to authenticated;
grant execute on function public.undo_habit_log(uuid, date) to authenticated;
