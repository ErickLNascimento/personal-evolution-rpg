-- Loja: onde gastar os Cristais.
--   · Cosméticos: auras, cores de roupa e de cabelo exclusivas (só trocam a paleta do herói).
--   · Recompensas personalizadas: prêmios da vida real criados pelo usuário e resgatados com Cristais.
-- Como sempre, Cristais só mudam por funções do banco (o app nunca grava coin_transactions).
--
-- Chaves de idempotência:
--   purchase:<user>:<cosmético>       compra de um cosmético (uma vez por item)
--   purchase:reward:<uuid>            resgate de uma recompensa (item_id = 'reward')

-- ─────────────────────────────────────────────────────────────
-- Cosméticos (espelha SHOP_COSMETICS de packages/domain/src/hero.ts)
-- ─────────────────────────────────────────────────────────────
create table public.cosmetic_catalog (
  id text primary key,
  slot text not null check (slot in ('aura', 'outfit', 'hairColor')),
  price integer not null check (price > 0)
);

insert into public.cosmetic_catalog (id, slot, price) values
  ('loja-cabelo-rosa', 'hairColor', 100),
  ('loja-cabelo-menta', 'hairColor', 100),
  ('loja-cabelo-fogo', 'hairColor', 100),
  ('loja-cabelo-neve', 'hairColor', 150),
  ('loja-roupa-marfim', 'outfit', 120),
  ('loja-roupa-vinho', 'outfit', 120),
  ('loja-roupa-celeste', 'outfit', 120),
  ('loja-roupa-grafite', 'outfit', 120),
  ('loja-aura-gelo', 'aura', 200),
  ('loja-aura-rubi', 'aura', 200),
  ('loja-aura-esmeralda', 'aura', 200),
  ('loja-aura-sakura', 'aura', 250),
  ('loja-aura-sombra', 'aura', 300);

create table public.user_cosmetics (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.cosmetic_catalog (id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.cosmetic_catalog enable row level security;
alter table public.user_cosmetics enable row level security;
create policy "cosmetic_catalog: leitura" on public.cosmetic_catalog for select to authenticated using (true);
create policy "user_cosmetics: ler o próprio" on public.user_cosmetics
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.cosmetic_catalog, public.user_cosmetics from anon, authenticated;
grant select on public.cosmetic_catalog, public.user_cosmetics to authenticated;

-- Compra um cosmético. Erros: P0002 item inexistente · PR002 já possui · PR004 Cristais insuficientes
create or replace function public.buy_cosmetic(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.cosmetic_catalog%rowtype;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into v_item from public.cosmetic_catalog where id = p_item_id;
  if not found then
    raise exception 'Item não encontrado' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':coins'));
  if exists (select 1 from public.user_cosmetics where user_id = v_user and item_id = p_item_id) then
    raise exception 'Você já possui este item' using errcode = 'PR002';
  end if;
  select coalesce(sum(amount), 0) into v_balance from public.coin_transactions where user_id = v_user;
  if v_balance < v_item.price then
    raise exception 'Cristais insuficientes' using errcode = 'PR004';
  end if;

  insert into public.user_cosmetics (user_id, item_id) values (v_user, p_item_id);
  insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
  values (v_user, -v_item.price, 'purchase', p_item_id, public.user_today(v_user),
          'purchase:' || v_user::text || ':' || p_item_id);

  return jsonb_build_object('item', p_item_id, 'coin_balance', v_balance - v_item.price);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Recompensas personalizadas
-- ─────────────────────────────────────────────────────────────
create table public.custom_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  emoji text check (emoji is null or char_length(emoji) <= 16),
  price integer not null check (price between 5 and 5000),
  created_at timestamptz not null default now()
);
create index custom_rewards_user_idx on public.custom_rewards (user_id, created_at);

-- Histórico de resgates (guarda nome e preço da época, mesmo se a recompensa mudar ou sumir).
create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward_id uuid references public.custom_rewards (id) on delete set null,
  title text not null,
  emoji text,
  price integer not null,
  redeemed_at timestamptz not null default now()
);
create index reward_redemptions_user_idx on public.reward_redemptions (user_id, redeemed_at desc);

alter table public.custom_rewards enable row level security;
alter table public.reward_redemptions enable row level security;
-- As recompensas são do usuário: ele cria, edita e apaga as próprias (não mexem em Cristais).
create policy "custom_rewards: ler o próprio" on public.custom_rewards
  for select to authenticated using (user_id = (select auth.uid()));
create policy "custom_rewards: criar o próprio" on public.custom_rewards
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "custom_rewards: editar o próprio" on public.custom_rewards
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "custom_rewards: apagar o próprio" on public.custom_rewards
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "reward_redemptions: ler o próprio" on public.reward_redemptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.custom_rewards, public.reward_redemptions from anon, authenticated;
grant select, insert, update, delete on public.custom_rewards to authenticated;
grant select on public.reward_redemptions to authenticated;

-- Resgata uma recompensa: desconta os Cristais e registra no histórico.
-- Erros: P0002 recompensa inexistente · PR004 Cristais insuficientes
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reward public.custom_rewards%rowtype;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into v_reward from public.custom_rewards where id = p_reward_id and user_id = v_user;
  if not found then
    raise exception 'Recompensa não encontrada' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':coins'));
  select coalesce(sum(amount), 0) into v_balance from public.coin_transactions where user_id = v_user;
  if v_balance < v_reward.price then
    raise exception 'Cristais insuficientes' using errcode = 'PR004';
  end if;

  insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
  values (v_user, -v_reward.price, 'purchase', 'reward', public.user_today(v_user),
          'purchase:reward:' || gen_random_uuid()::text);
  insert into public.reward_redemptions (user_id, reward_id, title, emoji, price)
  values (v_user, v_reward.id, v_reward.title, v_reward.emoji, v_reward.price);

  return jsonb_build_object('coin_balance', v_balance - v_reward.price);
end;
$$;

revoke execute on function public.buy_cosmetic(text) from public, anon;
revoke execute on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.buy_cosmetic(text) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
