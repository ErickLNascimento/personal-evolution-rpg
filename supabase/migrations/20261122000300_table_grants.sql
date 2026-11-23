-- Projetos Supabase novos não dão mais acesso automático às tabelas do schema public
-- para anon/authenticated. Os grants abaixo são explícitos e mínimos; o RLS continua
-- decidindo QUAIS linhas cada usuário vê. anon não acessa nenhuma tabela.

revoke all on all tables in schema public from anon;

-- Perfil: criado pelo trigger handle_new_user; o app só lê e edita.
grant select, update on public.profiles to authenticated;

-- Objetivos e hábitos: CRUD do próprio usuário (Sprint 2).
grant select, insert, update, delete on public.objectives to authenticated;
grant select, insert, update, delete on public.habits to authenticated;

-- Registros e XP: só leitura. Escrita apenas por log_habit / undo_habit_log.
grant select on public.habit_logs to authenticated;
grant select on public.xp_transactions to authenticated;
grant select on public.xp_rules to authenticated;

-- Planos da IA: o app lê e só decide (status, decided_at); o conteúdo vem da Edge Function.
grant select on public.ai_plans to authenticated;
grant update (status, decided_at) on public.ai_plans to authenticated;
