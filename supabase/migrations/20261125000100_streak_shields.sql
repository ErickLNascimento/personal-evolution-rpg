-- Escudos de streak: comprados com Cristais (até 2 guardados) e usados automaticamente pelo app
-- quando um dia já fechado quebraria a sequência. O banco confere tudo: preço, limite, saldo e
-- se o dia pode ser protegido. O app nunca grava Cristais nem escudos direto.
--
-- Chaves de idempotência:
--   purchase:escudo:<uuid>   compra de um escudo (item_id = 'escudo')

insert into public.coin_rules (key, amount) values
  ('coin_streak_shield', 60),   -- preço de um escudo
  ('streak_shield_max', 2);     -- escudos guardados ao mesmo tempo

-- Dias protegidos por um escudo (um escudo por dia).
create table public.streak_shield_uses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
alter table public.streak_shield_uses enable row level security;
create policy "streak_shield_uses: ler o próprio" on public.streak_shield_uses
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.streak_shield_uses from anon, authenticated;
grant select on public.streak_shield_uses to authenticated;

-- Escudos guardados = comprados − usados.
create or replace function public.streak_shields_held(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select (
    (select count(*) from public.coin_transactions
     where user_id = p_user_id and source_type = 'purchase' and item_id = 'escudo')
    - (select count(*) from public.streak_shield_uses where user_id = p_user_id)
  )::integer;
$$;

-- Escudos guardados, limite, preço e dias protegidos nos últimos 120 dias.
create or replace function public.my_streak_shields()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'held', public.streak_shields_held(v_user),
    'max', (select amount from public.coin_rules where key = 'streak_shield_max'),
    'price', (select amount from public.coin_rules where key = 'coin_streak_shield'),
    'used_dates', coalesce((
      select jsonb_agg(local_date order by local_date)
      from public.streak_shield_uses
      where user_id = v_user and local_date >= public.user_today(v_user) - 120), '[]'::jsonb)
  );
end;
$$;

-- Compra um escudo. Erros: PR020 limite de escudos · PR004 Cristais insuficientes
create or replace function public.buy_streak_shield()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_price integer;
  v_max integer;
  v_balance integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':coins'));

  select amount into v_price from public.coin_rules where key = 'coin_streak_shield';
  select amount into v_max from public.coin_rules where key = 'streak_shield_max';
  if public.streak_shields_held(v_user) >= v_max then
    raise exception 'Você já tem o máximo de escudos' using errcode = 'PR020';
  end if;
  select coalesce(sum(amount), 0) into v_balance from public.coin_transactions where user_id = v_user;
  if v_balance < v_price then
    raise exception 'Cristais insuficientes' using errcode = 'PR004';
  end if;

  insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
  values (v_user, -v_price, 'purchase', 'escudo', public.user_today(v_user),
          'purchase:escudo:' || gen_random_uuid()::text);

  return jsonb_build_object('held', public.streak_shields_held(v_user), 'coin_balance', v_balance - v_price);
end;
$$;

-- Usa um escudo num dia fechado (de 2 a 7 dias atrás) que tinha missão pendente.
-- Repetir o mesmo dia não gasta outro escudo.
-- Erros: 22023 dia fora da janela · PR021 dia sem missão pendente · PR022 sem escudos
create or replace function public.use_streak_shield(p_local_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  v_today := public.user_today(v_user);
  -- Ontem ainda aceita registro; antes de 7 dias, a sequência já não pode ser salva.
  if p_local_date > v_today - 2 or p_local_date < v_today - 7 then
    raise exception 'Só dá para proteger dias entre 2 e 7 dias atrás' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':coins'));
  if exists (select 1 from public.streak_shield_uses where user_id = v_user and local_date = p_local_date) then
    return jsonb_build_object('used', false, 'held', public.streak_shields_held(v_user));
  end if;
  if public.pending_scheduled_count(v_user, p_local_date) = 0 then
    raise exception 'Esse dia não tem missão pendente' using errcode = 'PR021';
  end if;
  if public.streak_shields_held(v_user) <= 0 then
    raise exception 'Sem escudos disponíveis' using errcode = 'PR022';
  end if;

  insert into public.streak_shield_uses (user_id, local_date) values (v_user, p_local_date);
  return jsonb_build_object('used', true, 'held', public.streak_shields_held(v_user));
end;
$$;

revoke execute on function public.streak_shields_held(uuid) from public, anon, authenticated;
revoke execute on function public.my_streak_shields() from public, anon;
revoke execute on function public.buy_streak_shield() from public, anon;
revoke execute on function public.use_streak_shield(date) from public, anon;
grant execute on function public.my_streak_shields() to authenticated;
grant execute on function public.buy_streak_shield() to authenticated;
grant execute on function public.use_streak_shield(date) to authenticated;
