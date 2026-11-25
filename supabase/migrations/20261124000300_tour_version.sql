-- Versão do tour: a equipe decide quando o tour aparece de novo para todos.
-- Para reexibir, aumente o número (pelo SQL Editor do Supabase):
--   update public.app_settings set value = value + 1 where key = 'tour_version';
-- Cada usuário vê o tour quando a última versão que viu é menor que a atual.

create table public.app_settings (
  key text primary key,
  value integer not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values ('tour_version', 1);

alter table public.app_settings enable row level security;
create policy "app_settings: leitura" on public.app_settings for select to authenticated using (true);
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;

-- Última versão do tour que o usuário viu (ou pulou). 0 = nunca viu.
alter table public.profiles add column tour_seen_version integer not null default 0;

-- Quem já viu o tour atual não precisa vê-lo de novo.
update public.profiles set tour_seen_version = 1 where tour_seen_at is not null;
