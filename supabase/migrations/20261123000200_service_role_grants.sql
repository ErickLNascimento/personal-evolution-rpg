-- Projetos Supabase novos também não dão acesso automático às tabelas para a service_role.
-- A Edge Function ai-plan usa a service_role só para checar o limite de uso
-- (ai_plan_block_reason lê profiles e ai_plans) e para gravar o plano proposto.
-- Acesso mínimo para isso, e nada além.

grant select on public.profiles to service_role;
grant select, insert on public.ai_plans to service_role;
