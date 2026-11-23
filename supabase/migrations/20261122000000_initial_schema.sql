-- Personal Evolution RPG — schema inicial da Fase 1
-- Seis tabelas + regras de XP. Toda tabela com dados pessoais tem RLS.
-- XP e registros de hábito só são gravados pelas funções log_habit / undo_habit_log.

-- ─────────────────────────────────────────────────────────────
-- Tipos e utilitários
-- ─────────────────────────────────────────────────────────────
create type public.difficulty as enum ('easy', 'medium', 'hard');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  timezone text not null default 'America/Sao_Paulo',
  difficulty public.difficulty not null default 'medium',
  focus_areas text[] not null default '{}',
  onboarding_done boolean not null default false,
  ai_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Fuso precisa ser um nome IANA válido.
create or replace function public.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone before insert or update of timezone on public.profiles
  for each row execute function public.validate_timezone();

-- Cria o perfil automaticamente no cadastro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- objectives
-- ─────────────────────────────────────────────────────────────
create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in (
    'health', 'career', 'finance', 'knowledge', 'productivity',
    'relationships', 'wellbeing', 'personal_growth'
  )),
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index objectives_user_idx on public.objectives (user_id);
create trigger objectives_updated_at before update on public.objectives
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- habits
-- ─────────────────────────────────────────────────────────────
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  objective_id uuid references public.objectives (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  difficulty public.difficulty not null default 'easy',
  -- 0 = domingo … 6 = sábado (igual ao extract(dow) do Postgres e ao domain)
  schedule_days smallint[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(schedule_days) between 1 and 7 and schedule_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  target_qty numeric check (target_qty is null or target_qty > 0),
  unit text check (char_length(unit) <= 20),
  reminder_time time,
  start_date date not null,
  archived_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (archived_on is null or archived_on >= start_date)
);

create index habits_user_idx on public.habits (user_id) where archived_on is null;
create trigger habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- habit_logs (somente leitura para o app; escrita via função)
-- ─────────────────────────────────────────────────────────────
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  local_date date not null,
  qty numeric check (qty is null or qty > 0),
  created_at timestamptz not null default now(),
  unique (habit_id, local_date)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, local_date);

-- ─────────────────────────────────────────────────────────────
-- xp_rules (configuração do balanceamento, editável só pelo backend)
-- ─────────────────────────────────────────────────────────────
create table public.xp_rules (
  key text primary key,
  amount integer not null check (amount >= 0),
  updated_at timestamptz not null default now()
);

insert into public.xp_rules (key, amount) values
  ('habit_easy', 10),
  ('habit_medium', 20),
  ('habit_hard', 30),
  ('perfect_day_bonus', 20);

-- ─────────────────────────────────────────────────────────────
-- xp_transactions (fonte de verdade do XP; nunca alterada, só acrescida)
-- ─────────────────────────────────────────────────────────────
create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  source_type text not null check (source_type in ('habit', 'perfect_day', 'reversal')),
  source_id uuid,
  local_date date not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index xp_transactions_user_idx on public.xp_transactions (user_id, created_at desc);
create index xp_transactions_user_date_idx on public.xp_transactions (user_id, local_date);

-- ─────────────────────────────────────────────────────────────
-- ai_plans (propostas da IA; gravadas pela Edge Function com service role)
-- ─────────────────────────────────────────────────────────────
create table public.ai_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('initial', 'weekly')),
  payload jsonb not null,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  prompt_version text not null,
  tokens_used integer,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index ai_plans_user_idx on public.ai_plans (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.objectives enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.xp_rules enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.ai_plans enable row level security;

create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: editar o próprio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "objectives: tudo no próprio" on public.objectives
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "habits: tudo no próprio" on public.habits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      objective_id is null
      or exists (
        select 1 from public.objectives o
        where o.id = objective_id and o.user_id = (select auth.uid())
      )
    )
  );

create policy "habit_logs: ler o próprio" on public.habit_logs
  for select to authenticated using (user_id = (select auth.uid()));

create policy "xp_rules: leitura" on public.xp_rules
  for select to authenticated using (true);

create policy "xp_transactions: ler o próprio" on public.xp_transactions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "ai_plans: ler o próprio" on public.ai_plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_plans: decidir o próprio" on public.ai_plans
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- O app só pode mudar a decisão de um plano, nunca o conteúdo.
revoke update on public.ai_plans from authenticated;
grant update (status, decided_at) on public.ai_plans to authenticated;

-- Registros e XP não são graváveis diretamente pelo app.
revoke insert, update, delete on public.habit_logs from anon, authenticated;
revoke insert, update, delete on public.xp_transactions from anon, authenticated;
revoke insert, update, delete on public.xp_rules from anon, authenticated;
