-- Tour do app no primeiro acesso e feedback dos testadores.

-- Quando o usuário viu (ou pulou) o tour. Nulo = mostrar no próximo acesso à tela Hoje.
alter table public.profiles add column tour_seen_at timestamptz;

-- Feedback enviado pelo app. O usuário só cria e lê o próprio; quem lê todos é a equipe,
-- pelo painel do Supabase (service role).
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('bug', 'ideia', 'elogio', 'outro')),
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  app_version text check (char_length(app_version) <= 40),
  platform text check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now()
);

create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
create policy "feedback: criar o próprio" on public.feedback
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "feedback: ler o próprio" on public.feedback
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
grant select on public.feedback to service_role;
