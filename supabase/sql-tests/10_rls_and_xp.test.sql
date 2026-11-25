-- Testes de RLS e XP. Rodar num banco novo, depois do stub e das migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/sql-tests/00_supabase_stub.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/migrations/*.sql   (em ordem)
--   psql -v ON_ERROR_STOP=1 -f supabase/sql-tests/10_rls_and_xp.test.sql
-- Qualquer falha interrompe com erro; no fim imprime "ALL TESTS PASSED".

\set ON_ERROR_STOP on
begin;

create function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
end $$;

create function pg_temp.today() returns date language sql as $$
  select (now() at time zone 'America/Manaus')::date
$$;

create function pg_temp.dow_not_today() returns smallint language sql as $$
  select ((extract(dow from pg_temp.today())::int + 1) % 7)::smallint
$$;

-- Usuários (o trigger cria os perfis)
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@teste.dev', '{"display_name":"Ana"}'),
  ('22222222-2222-2222-2222-222222222222', 'bia@teste.dev', '{}');

do $$ begin
  perform pg_temp.check((select count(*) from public.profiles) = 2, 'perfil criado no cadastro');
  perform pg_temp.check(
    (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Ana',
    'display_name vem do metadata');
end $$;

-- Cadastro grava o fuso do aparelho; fuso inválido não impede o cadastro
insert into auth.users (id, email, raw_user_meta_data) values
  ('33333333-3333-3333-3333-333333333333', 'caio@teste.dev', '{"timezone":"America/Manaus"}'),
  ('44444444-4444-4444-4444-444444444444', 'dani@teste.dev', '{"timezone":"Lugar/Nenhum","display_name":"   "}');

do $$ begin
  perform pg_temp.check(
    (select timezone from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 'America/Manaus',
    'fuso do metadata vai para o perfil');
  perform pg_temp.check(
    (select timezone from public.profiles where id = '44444444-4444-4444-4444-444444444444') = 'America/Sao_Paulo',
    'fuso inválido no cadastro cai no padrão');
  perform pg_temp.check(
    (select display_name from public.profiles where id = '44444444-4444-4444-4444-444444444444') is null,
    'nome só com espaços vira nulo');
  perform pg_temp.check(
    (select timezone from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'America/Sao_Paulo',
    'sem fuso no metadata usa o padrão');
end $$;

delete from auth.users where id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');

-- Fuso inválido é recusado
do $$ begin
  begin
    update public.profiles set timezone = 'Manaus/Errado' where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'FALHOU: aceitou fuso inválido';
  exception when invalid_parameter_value then null;
  end;
end $$;

update public.profiles set timezone = 'America/Manaus';

-- ── Usuária A ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

update public.profiles set onboarding_done = true;

insert into public.objectives (id, title, category)
values ('a0000000-0000-0000-0000-000000000001', 'Ter mais saúde', 'health');

insert into public.habits (id, objective_id, title, difficulty, start_date) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ler 10 páginas', 'easy', pg_temp.today() - 7),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Treinar', 'hard', pg_temp.today() - 7);

insert into public.habits (id, title, difficulty, schedule_days, start_date)
values ('a1000000-0000-0000-0000-000000000003', 'Só em outro dia', 'medium', array[pg_temp.dow_not_today()], pg_temp.today() - 7);

do $$
declare r jsonb;
begin
  -- registrar dá XP
  r := public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today());
  perform pg_temp.check((r->>'logged')::boolean, 'primeiro registro grava');
  perform pg_temp.check((r->>'xp_awarded')::int = 10, 'fácil = 10 XP');
  perform pg_temp.check((r->>'total_xp')::int = 10, 'total 10');

  -- registrar de novo não duplica
  r := public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today());
  perform pg_temp.check(not (r->>'logged')::boolean, 'segundo registro ignorado');
  perform pg_temp.check((r->>'xp_awarded')::int = 0, 'sem XP duplicado');
  perform pg_temp.check((r->>'total_xp')::int = 10, 'total continua 10');

  -- completar o dia dá bônus
  r := public.log_habit('a1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check((r->>'xp_awarded')::int = 30, 'difícil = 30 XP');
  perform pg_temp.check((r->>'perfect_day_bonus')::int = 20, 'bônus de dia perfeito');
  perform pg_temp.check((r->>'total_xp')::int = 60, 'total 60');

  -- desfazer estorna o hábito e o bônus
  r := public.undo_habit_log('a1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check((r->>'undone')::boolean, 'desfez');
  perform pg_temp.check((r->>'xp_reverted')::int = 50, 'estornou 30 + 20');
  perform pg_temp.check((r->>'total_xp')::int = 10, 'total volta a 10');

  -- desfazer de novo não faz nada
  r := public.undo_habit_log('a1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check(not (r->>'undone')::boolean, 'segundo desfazer ignorado');
  perform pg_temp.check((r->>'total_xp')::int = 10, 'total continua 10');

  -- registrar de novo funciona e o bônus volta
  r := public.log_habit('a1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check((r->>'xp_awarded')::int = 30, 'registra de novo');
  perform pg_temp.check((r->>'perfect_day_bonus')::int = 20, 'bônus volta');
  perform pg_temp.check((r->>'total_xp')::int = 60, 'total 60 de novo');
  perform pg_temp.check(public.my_total_xp() = 60, 'my_total_xp bate');

  -- registro de ontem é aceito
  r := public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today() - 1);
  perform pg_temp.check((r->>'logged')::boolean, 'ontem permitido');

  -- histórico é auditável: nada foi apagado de xp_transactions
  perform pg_temp.check((select count(*) from public.xp_transactions) = 8, '8 transações: 4 de hábito, 2 bônus, 2 estornos');
end $$;

-- Datas fora da janela e hábito não agendado são recusados
do $$ begin
  begin
    perform public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today() + 1);
    raise exception 'FALHOU: aceitou data futura';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today() - 2);
    raise exception 'FALHOU: aceitou anteontem';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.log_habit('a1000000-0000-0000-0000-000000000003', pg_temp.today());
    raise exception 'FALHOU: aceitou hábito fora da agenda';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- O app não grava XP nem registros diretamente
do $$ begin
  begin
    insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 9999, 'habit', pg_temp.today(), 'hack');
    raise exception 'FALHOU: inseriu XP direto';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.habit_logs (user_id, habit_id, local_date)
    values ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000003', pg_temp.today());
    raise exception 'FALHOU: inseriu registro direto';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.xp_rules set amount = 1000;
    raise exception 'FALHOU: alterou xp_rules';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Histórico de hábitos (Sprint 2): o hábito 1 tem registros de ontem e de hoje
do $$
declare n int;
begin
  begin
    delete from public.habits where id = 'a1000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: excluiu hábito com registros';
  exception when restrict_violation then null;
  end;

  begin
    update public.habits set archived_on = pg_temp.today() - 1 where id = 'a1000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: arquivou antes do último registro';
  exception when check_violation then null;
  end;

  begin
    update public.habits set start_date = pg_temp.today() where id = 'a1000000-0000-0000-0000-000000000001';
    raise exception 'FALHOU: início depois do primeiro registro';
  exception when check_violation then null;
  end;

  -- arquivar no dia do último registro é permitido; editar outros campos também
  update public.habits set archived_on = pg_temp.today(), title = 'Ler 15 páginas'
    where id = 'a1000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 1, 'arquiva no dia do último registro');
  update public.habits set archived_on = null where id = 'a1000000-0000-0000-0000-000000000001';

  -- hábito sem registros pode ser excluído
  insert into public.habits (id, title, start_date)
  values ('a1000000-0000-0000-0000-000000000009', 'Criado por engano', pg_temp.today());
  delete from public.habits where id = 'a1000000-0000-0000-0000-000000000009';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 1, 'exclui hábito sem registros');
end $$;

-- Plano da IA: a Edge Function grava (service role); o app só decide por decide_ai_plan
reset role;
insert into public.ai_plans (id, user_id, kind, payload, prompt_version) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'initial',
   '{"summary":"Plano","habits":[
      {"title":"Beber 2 L de água","difficulty":"easy","schedule_days":[0,1,2,3,4,5,6],
       "objective_title":"ter mais saúde","objective_category":"health","rationale":"r"},
      {"title":"Revisar finanças","difficulty":"medium","schedule_days":[0,0,6],
       "objective_title":"Organizar o dinheiro","objective_category":"finance","rationale":"r"},
      {"title":"Não escolhido","difficulty":"hard","schedule_days":[1],
       "objective_title":null,"objective_category":"health","rationale":"r"}]}', 'plan-v1'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'weekly',
   '{"summary":"Semana","habits":[{"title":"x","difficulty":"easy","schedule_days":[1],
     "objective_title":null,"objective_category":"health","rationale":"r"}]}', 'plan-v1'),
  ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'weekly',
   '{"summary":"Inválido","habits":[{"title":"","difficulty":"easy","schedule_days":[1],
     "objective_title":null,"objective_category":"health","rationale":"r"}]}', 'plan-v1');
set local role authenticated;

do $$
declare r jsonb; n int;
begin
  -- aceitar dois de três: cria só os escolhidos, reusa o objetivo de mesmo nome e cria o novo
  r := public.decide_ai_plan('c0000000-0000-0000-0000-000000000001', true, array[1, 0, 1]);
  perform pg_temp.check((r->>'habits_created')::int = 2, 'aceita só os escolhidos (sem duplicar)');
  perform pg_temp.check((select status from public.ai_plans where id = 'c0000000-0000-0000-0000-000000000001') = 'accepted', 'plano aceito');
  perform pg_temp.check((select count(*) from public.habits where title in ('Beber 2 L de água', 'Revisar finanças')) = 2, 'hábitos criados');
  perform pg_temp.check(not exists (select 1 from public.habits where title = 'Não escolhido'), 'não escolhido fica de fora');
  perform pg_temp.check((select count(*) from public.objectives where lower(title) = 'ter mais saúde') = 1, 'reusa objetivo de mesmo nome');
  perform pg_temp.check(
    (select o.title from public.habits h join public.objectives o on o.id = h.objective_id where h.title = 'Beber 2 L de água') = 'Ter mais saúde',
    'hábito ligado ao objetivo existente');
  perform pg_temp.check(exists (select 1 from public.objectives where title = 'Organizar o dinheiro' and category = 'finance'), 'cria objetivo novo');
  perform pg_temp.check((select schedule_days from public.habits where title = 'Revisar finanças') = '{0,6}', 'agenda sem dias repetidos');
  perform pg_temp.check((select start_date from public.habits where title = 'Revisar finanças') = pg_temp.today(), 'começa hoje no fuso do usuário');

  begin
    perform public.decide_ai_plan('c0000000-0000-0000-0000-000000000001', false);
    raise exception 'FALHOU: decidiu o mesmo plano duas vezes';
  exception when invalid_parameter_value then null;
  end;

  -- sugestão inexistente ou inválida: nada é criado e o plano continua proposto
  begin
    perform public.decide_ai_plan('c0000000-0000-0000-0000-000000000002', true, array[5]);
    raise exception 'FALHOU: aceitou sugestão inexistente';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.decide_ai_plan('c0000000-0000-0000-0000-000000000002', true, array[-1]);
    raise exception 'FALHOU: aceitou índice negativo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.decide_ai_plan('c0000000-0000-0000-0000-000000000003', true, array[0]);
    raise exception 'FALHOU: aceitou hábito sem título';
  exception when check_violation then null;
  end;
  perform pg_temp.check((select status from public.ai_plans where id = 'c0000000-0000-0000-0000-000000000003') = 'proposed', 'falha não decide o plano');

  -- recusar não cria nada
  select count(*) into n from public.habits;
  r := public.decide_ai_plan('c0000000-0000-0000-0000-000000000002', false);
  perform pg_temp.check(r->>'status' = 'rejected', 'plano recusado');
  perform pg_temp.check((select count(*) from public.habits) = n, 'recusa não cria hábito');

  -- o app não altera planos diretamente nem consulta o limite de uso
  begin
    update public.ai_plans set status = 'accepted' where id = 'c0000000-0000-0000-0000-000000000003';
    raise exception 'FALHOU: alterou o plano direto';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'initial');
    raise exception 'FALHOU: app chamou ai_plan_block_reason';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ajustes nas sugestões antes de aceitar
reset role;
insert into public.ai_plans (id, user_id, kind, payload, prompt_version) values
  ('c0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'initial',
   '{"summary":"Ajustes","habits":[
      {"title":"Ler 10 páginas","difficulty":"easy","schedule_days":[1],"objective_title":"Estudos","objective_category":"knowledge","rationale":"r"},
      {"title":"Correr","difficulty":"easy","schedule_days":[1],"objective_title":"Estudos","objective_category":"knowledge","rationale":"r"}]}', 'plan-v1'),
  ('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'initial',
   '{"summary":"Ajuste inválido","habits":[
      {"title":"Algo","difficulty":"easy","schedule_days":[1],"objective_title":null,"objective_category":"health","rationale":"r"}]}', 'plan-v1');
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.decide_ai_plan('c0000000-0000-0000-0000-000000000004', true, array[0, 1],
    '[{"index":0,"title":"Ler 3 páginas","difficulty":"hard","schedule_days":[4,2,4]},
      {"index":7,"title":"ignorado","difficulty":"easy","schedule_days":[1]}]');
  perform pg_temp.check((r->>'habits_created')::int = 2, 'aceita com ajustes');
  perform pg_temp.check(
    (select difficulty = 'hard' and schedule_days = '{2,4}' from public.habits where title = 'Ler 3 páginas'),
    'usa nome, dificuldade e dias ajustados');
  perform pg_temp.check(not exists (select 1 from public.habits where title = 'Ler 10 páginas'), 'nome original substituído');
  perform pg_temp.check(exists (select 1 from public.habits where title = 'Correr' and difficulty = 'easy'), 'sem ajuste, fica como veio');

  begin
    perform public.decide_ai_plan('c0000000-0000-0000-0000-000000000005', true, array[0],
      '[{"index":0,"title":"","difficulty":"easy","schedule_days":[1]}]');
    raise exception 'FALHOU: aceitou ajuste sem nome';
  exception when check_violation then null;
  end;
  perform pg_temp.check((select status from public.ai_plans where id = 'c0000000-0000-0000-0000-000000000005') = 'proposed', 'ajuste inválido não decide o plano');

  begin
    update public.ai_plans set swaps = 3 where id = 'c0000000-0000-0000-0000-000000000005';
    raise exception 'FALHOU: app alterou o contador de trocas';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Limite de pedidos à IA (consultado pela Edge Function com service role)
reset role;
-- A Edge Function ai-plan roda como service_role: precisa checar o limite e gravar o plano.
set local role service_role;
-- precisa funcionar (sem tratar exceção: permissão negada aqui derruba o teste)
do $$ begin
  perform public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'initial');
  insert into public.ai_plans (user_id, kind, payload, prompt_version)
  values ('11111111-1111-1111-1111-111111111111', 'weekly', '{"summary":"service","habits":[]}', 'plan-v1');
  -- "Trocar esta": a função troca o conteúdo e conta a troca
  update public.ai_plans set payload = '{"summary":"trocado","habits":[]}', swaps = swaps + 1
  where id = 'c0000000-0000-0000-0000-000000000005';
end $$;
do $$ begin
  begin
    update public.ai_plans set status = 'accepted' where id = 'c0000000-0000-0000-0000-000000000005';
    raise exception 'FALHOU: service_role decidiu um plano';
  exception when insufficient_privilege then null;
  end;
end $$;
-- e não pode ir além de ler e inserir
do $$ begin
  begin
    delete from public.ai_plans where payload = '{"summary":"service","habits":[]}'::jsonb;
    raise exception 'FALHOU: service_role apagou plano';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.ai_plans where payload = '{"summary":"service","habits":[]}'::jsonb;
-- os planos de teste dos ajustes não devem contar no limite diário testado a seguir
delete from public.ai_plans where id in ('c0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000005');
reset role;
do $$ begin
  update public.profiles set ai_consent_at = null where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.check(
    public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'initial') like '%permissão%',
    'sem consentimento, a IA é bloqueada');

  update public.profiles set ai_consent_at = now() where id = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.check(public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'initial') is null, 'com consentimento, pode pedir');

  insert into public.ai_plans (user_id, kind, payload, prompt_version)
  select '11111111-1111-1111-1111-111111111111', 'initial', '{"summary":"","habits":[]}', 'plan-v1' from generate_series(1, 2);
  perform pg_temp.check(public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'initial') is not null, '3 planos iniciais no dia: bloqueia');
  perform pg_temp.check(public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'weekly') is not null, '2 revisões na semana: bloqueia');
  perform pg_temp.check(public.ai_plan_block_reason('11111111-1111-1111-1111-111111111111', 'outro') is not null, 'tipo inválido bloqueia');
end $$;
set local role authenticated;

-- ── Usuária B não vê nem mexe nos dados de A ─────────────────
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;

do $$
declare n int;
begin
  perform pg_temp.check((select count(*) from public.profiles) = 1, 'B vê só o próprio perfil');
  perform pg_temp.check((select count(*) from public.habits) = 0, 'B não vê hábitos de A');
  perform pg_temp.check((select count(*) from public.objectives) = 0, 'B não vê objetivos de A');
  perform pg_temp.check((select count(*) from public.habit_logs) = 0, 'B não vê registros de A');
  perform pg_temp.check((select count(*) from public.xp_transactions) = 0, 'B não vê XP de A');
  perform pg_temp.check((select count(*) from public.ai_plans) = 0, 'B não vê planos de A');
  perform pg_temp.check(public.my_total_xp() = 0, 'XP de B = 0');
  perform pg_temp.check((select count(*) from public.xp_rules) = 5, 'regras de XP são públicas (inclui o bônus relâmpago)');

  -- Perfil (tela Perfil): B edita o próprio consentimento e fuso, nunca o de A
  update public.profiles set ai_consent_at = now(), timezone = 'Europe/Lisbon';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 1, 'B atualiza só o próprio perfil');
  update public.profiles set ai_consent_at = now(), display_name = 'hack'
    where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'B não altera o perfil de A');
  update public.profiles set ai_consent_at = null;
  perform pg_temp.check(
    (select ai_consent_at from public.profiles) is null, 'B revoga o consentimento da IA');

  update public.habits set title = 'hack' where id = 'a1000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'B não edita hábito de A');

  delete from public.objectives where id = 'a0000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'B não apaga objetivo de A');

  begin
    perform public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today());
    raise exception 'FALHOU: B registrou hábito de A';
  exception when no_data_found then null;
  end;

  begin
    insert into public.habits (title, objective_id, start_date)
    values ('Ligado ao objetivo de A', 'a0000000-0000-0000-0000-000000000001', pg_temp.today());
    raise exception 'FALHOU: B ligou hábito a objetivo de A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.habits (user_id, title, start_date)
    values ('11111111-1111-1111-1111-111111111111', 'Em nome de A', pg_temp.today());
    raise exception 'FALHOU: B criou hábito para A';
  exception when insufficient_privilege then null;
  end;

  -- Grants mínimos: perfil só nasce pelo trigger, e o app não apaga perfil nem reescreve plano da IA
  begin
    insert into public.profiles (id) values ('55555555-5555-5555-5555-555555555555');
    raise exception 'FALHOU: app criou perfil direto';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.profiles;
    raise exception 'FALHOU: app apagou perfil';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.ai_plans set payload = '{}'::jsonb;
    raise exception 'FALHOU: app alterou o conteúdo de um plano da IA';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Visitante sem login ──────────────────────────────────────
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
declare t text;
begin
  -- anon não tem acesso a nenhuma tabela (nem pelo RLS, nem pelos grants)
  foreach t in array array['profiles', 'objectives', 'habits', 'habit_logs', 'xp_rules', 'xp_transactions', 'ai_plans',
                          'coin_rules', 'class_catalog', 'coin_transactions', 'user_unlocks', 'title_catalog', 'user_titles'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FALHOU: anon leu a tabela %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    perform public.log_habit('a1000000-0000-0000-0000-000000000001', pg_temp.today());
    raise exception 'FALHOU: anon chamou log_habit';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Onboarding ───────────────────────────────────────────────
reset role;
insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'eva@teste.dev');
insert into public.objectives (user_id, title, category)
values ('66666666-6666-6666-6666-666666666666', 'saúde', 'health');
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
set local role authenticated;

do $$
declare r jsonb;
begin
  -- áreas fora da lista ou mais de 3 são recusadas, e nada é salvo
  begin
    perform public.complete_onboarding('Eva', array['magia'], 'easy', 'America/Manaus');
    raise exception 'FALHOU: aceitou área inválida';
  exception when check_violation then null;
  end;
  begin
    perform public.complete_onboarding('Eva', array['health', 'career', 'finance', 'knowledge'], 'easy', 'America/Manaus');
    raise exception 'FALHOU: aceitou 4 áreas';
  exception when check_violation then null;
  end;
  begin
    perform public.complete_onboarding('Eva', array['health'], 'easy', 'Lugar/Nenhum');
    raise exception 'FALHOU: aceitou fuso inválido';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.check(not (select onboarding_done from public.profiles), 'falha não conclui o onboarding');

  r := public.complete_onboarding('  Eva  ', array['health', 'knowledge'], 'medium', 'America/Manaus',
    '[{"title":"Beber 2 L de água","difficulty":"easy","schedule_days":[0,1,2,3,4,5,6],
       "objective_title":"Saúde","objective_category":"health"},
      {"title":"Ler 10 páginas","difficulty":"easy","schedule_days":[1,1,3],
       "objective_title":"Conhecimento","objective_category":"knowledge"}]');
  perform pg_temp.check((r->>'habits_created')::int = 2, 'onboarding cria os hábitos escolhidos');
  perform pg_temp.check(
    (select display_name = 'Eva' and focus_areas = '{health,knowledge}' and difficulty = 'medium'
            and timezone = 'America/Manaus' and onboarding_done from public.profiles),
    'onboarding salva o perfil');
  perform pg_temp.check((select count(*) from public.objectives) = 2, 'reusa "saúde" e cria "Conhecimento"');
  perform pg_temp.check((select schedule_days from public.habits where title = 'Ler 10 páginas') = '{1,3}', 'agenda sem repetição');
  perform pg_temp.check((select bool_and(start_date = pg_temp.today()) from public.habits), 'hábitos começam hoje');

  begin
    perform public.complete_onboarding('Eva', array['health'], 'easy', 'America/Manaus');
    raise exception 'FALHOU: concluiu o onboarding duas vezes';
  exception when sqlstate 'PR001' then null;
  end;
end $$;

-- Herói e atributos (Eva concluiu o onboarding com "Beber 2 L de água" → Saúde)
do $$
declare v_habit uuid;
begin
  update public.profiles set hero = '{"heroClass":"mago","hair":"coque"}';
  perform pg_temp.check((select hero->>'heroClass' from public.profiles) = 'mago', 'salva a aparência do herói');
  begin
    update public.profiles set hero = '["não é objeto"]';
    raise exception 'FALHOU: aceitou herói que não é objeto';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set hero = jsonb_build_object('x', repeat('a', 3000));
    raise exception 'FALHOU: aceitou herói enorme';
  exception when check_violation then null;
  end;

  perform pg_temp.check(not exists (select 1 from public.my_attribute_xp()), 'sem registros, atributos vazios');

  select id into v_habit from public.habits where title = 'Beber 2 L de água';
  perform public.log_habit(v_habit, pg_temp.today());
  perform pg_temp.check(
    (select xp from public.my_attribute_xp() where category = 'health') = 10, 'XP do hábito vai para a área do objetivo');

  -- mudar a dificuldade depois não altera o que foi ganho
  update public.habits set difficulty = 'hard' where id = v_habit;
  perform pg_temp.check((select xp from public.my_attribute_xp() where category = 'health') = 10, 'atributo usa o XP ganho de fato');

  -- desfazer tira o XP do atributo
  perform public.undo_habit_log(v_habit, pg_temp.today());
  perform pg_temp.check(not exists (select 1 from public.my_attribute_xp()), 'registro desfeito sai do atributo');
end $$;

-- pular o onboarding (sem hábitos) também conclui
reset role;
insert into auth.users (id, email) values ('77777777-7777-7777-7777-777777777777', 'fabi@teste.dev');
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
set local role authenticated;
do $$ begin
  perform public.complete_onboarding('', '{}', 'easy', 'America/Sao_Paulo');
  perform pg_temp.check((select onboarding_done and display_name is null from public.profiles), 'pular conclui sem dados');
  perform pg_temp.check((select count(*) from public.habits) = 0, 'pular não cria hábito');
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $$ begin
  begin
    perform public.complete_onboarding('x', '{}', 'easy', 'UTC');
    raise exception 'FALHOU: anon concluiu onboarding';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Cristais ─────────────────────────────────────────────────
-- Gil: caminho Marcial (estágio 0, +5% em Saúde), com 990 XP (nível 4).
reset role;
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'gil@teste.dev');
update public.profiles set timezone = 'America/Manaus' where id = '88888888-8888-8888-8888-888888888888';
insert into public.objectives (id, user_id, title, category)
values ('b0000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', 'Saúde', 'health');
insert into public.habits (id, user_id, objective_id, title, difficulty, start_date) values
  ('b1000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888',
   'b0000000-0000-0000-0000-000000000001', 'Caminhar', 'easy', pg_temp.today() - 1),
  ('b1000000-0000-0000-0000-000000000002', '88888888-8888-8888-8888-888888888888',
   null, 'Escrever', 'medium', pg_temp.today() - 1);
insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
values ('88888888-8888-8888-8888-888888888888', 990, 'habit', pg_temp.today() - 30, 'seed:gil');
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
set local role authenticated;

do $$
declare r jsonb;
begin
  -- sem caminho ainda; a primeira escolha não inicia a espera de troca
  r := public.my_hero_path();
  perform pg_temp.check(r->>'path' is null and (r->>'level')::int = 4, 'sem caminho, nível 4');
  r := public.choose_path('marcial');
  perform pg_temp.check((r->>'stage')::int = 0 and (r->>'changed')::boolean, 'escolhe Marcial no estágio 0');
  perform pg_temp.check((select path_changed_at from public.profiles) is null, 'primeira escolha sem espera');

  -- fácil (5) + 5% em Saúde (arredonda para cima: +1) = 6; e o XP chega a 1000 → nível 5 → +50
  r := public.log_habit('b1000000-0000-0000-0000-000000000001', pg_temp.today());
  perform pg_temp.check((r->>'xp_awarded')::int = 10, 'XP da missão continua igual');
  perform pg_temp.check((r->>'flash_bonus')::int = 0, 'sem missão relâmpago, sem bônus');
  perform pg_temp.check((r->>'coins_awarded')::int = 56, 'missão (6) + subida para o nível 5 (50)');
  perform pg_temp.check((r->>'coin_balance')::int = 56, 'saldo 56');
  perform pg_temp.check(public.my_coin_balance() = 56, 'my_coin_balance bate');

  -- média sem objetivo (fora da área) = 10; dia perfeito = +15 Cristais (e +20 XP)
  r := public.log_habit('b1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check((r->>'perfect_day_bonus')::int = 20, 'bônus de XP do dia perfeito continua');
  perform pg_temp.check((r->>'coins_awarded')::int = 25, 'missão (10) + dia perfeito (15)');
  perform pg_temp.check((r->>'coin_balance')::int = 81, 'saldo 81');

  -- desfazer estorna a missão e o dia perfeito; os Cristais de nível ficam
  r := public.undo_habit_log('b1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check((r->>'coins_reverted')::int = 25, 'estorna exatamente 25');
  perform pg_temp.check((r->>'coin_balance')::int = 56, 'volta a 56; nível não é estornado');

  r := public.log_habit('b1000000-0000-0000-0000-000000000002', pg_temp.today());
  perform pg_temp.check((r->>'coin_balance')::int = 81, 'registrar de novo devolve 25');

  -- missão de ontem rende metade: ceil(5/2)=3, +5% Saúde = 4
  r := public.log_habit('b1000000-0000-0000-0000-000000000001', pg_temp.today() - 1);
  perform pg_temp.check((r->>'coins_awarded')::int = 4, 'ontem rende metade');

  -- a loja de classes acabou: a classe vem do caminho
  begin
    perform public.buy_item('paladino');
    raise exception 'FALHOU: comprou classe';
  exception when insufficient_privilege then null;
  end;

  -- o app não grava Cristais nem desbloqueios direto
  begin
    insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
    values ('88888888-8888-8888-8888-888888888888', 9999, 'habit', pg_temp.today(), 'hack');
    raise exception 'FALHOU: inseriu Cristais direto';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_unlocks (user_id, item_id) values ('88888888-8888-8888-8888-888888888888', 'necromante');
    raise exception 'FALHOU: desbloqueou classe direto';
  exception when insufficient_privilege then null;
  end;

  -- caminho, ramo e estágio não se editam direto; raça e aparência sim
  begin
    update public.profiles set stage = 5;
    raise exception 'FALHOU: pulou de estágio direto';
  exception when sqlstate 'PR010' then null;
  end;
  begin
    update public.profiles set path = 'arcano';
    raise exception 'FALHOU: trocou de caminho direto';
  exception when sqlstate 'PR010' then null;
  end;
  update public.profiles set race = 'elfo', hero = '{"heroClass":"paladino"}';
  perform pg_temp.check((select race from public.profiles) = 'elfo', 'raça é escolha livre');
  begin
    update public.profiles set race = 'vampiro';
    raise exception 'FALHOU: aceitou raça desconhecida';
  exception when check_violation then null;
  end;
end $$;

-- ── Títulos ──────────────────────────────────────────────────
-- Gil (nível 5, com registros): Primeiro Passo já veio com a primeira missão.
do $$ begin
  perform pg_temp.check(exists (select 1 from public.user_titles where title_id = 'primeiro-passo'), 'primeira missão dá Primeiro Passo');
  perform pg_temp.check(not exists (select 1 from public.user_titles where title_id = 'centuriao'), 'Centurião só com 100 missões');

  update public.profiles set equipped_title = 'nivel-5';
  perform pg_temp.check((select equipped_title from public.profiles) = 'nivel-5', 'exibe título de nível alcançado');
  update public.profiles set equipped_title = 'primeiro-passo';
  perform pg_temp.check((select equipped_title from public.profiles) = 'primeiro-passo', 'exibe título conquistado');
  update public.profiles set equipped_title = null;

  begin
    update public.profiles set equipped_title = 'nivel-10';
    raise exception 'FALHOU: exibiu título de nível não alcançado';
  exception when sqlstate 'PR007' then null;
  end;
  begin
    update public.profiles set equipped_title = 'fenix';
    raise exception 'FALHOU: exibiu título secreto não conquistado';
  exception when sqlstate 'PR007' then null;
  end;
  begin
    insert into public.user_titles (user_id, title_id) values ('88888888-8888-8888-8888-888888888888', 'equilibrio-perfeito');
    raise exception 'FALHOU: concedeu título direto';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Hana: 4 hábitos em 4 áreas; o último registro dela foi há 10 dias.
reset role;
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', 'hana@teste.dev');
update public.profiles set timezone = 'America/Manaus' where id = '99999999-9999-9999-9999-999999999999';
insert into public.objectives (id, user_id, title, category) values
  ('c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'Saúde', 'health'),
  ('c1000000-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999', 'Estudo', 'knowledge'),
  ('c1000000-0000-0000-0000-000000000003', '99999999-9999-9999-9999-999999999999', 'Dinheiro', 'finance'),
  ('c1000000-0000-0000-0000-000000000004', '99999999-9999-9999-9999-999999999999', 'Amigos', 'relationships');
insert into public.habits (id, user_id, objective_id, title, start_date)
select ('c2000000-0000-0000-0000-00000000000' || i)::uuid, '99999999-9999-9999-9999-999999999999',
       ('c1000000-0000-0000-0000-00000000000' || i)::uuid, 'Hábito ' || i, pg_temp.today() - 20
from generate_series(1, 4) i;
insert into public.habit_logs (user_id, habit_id, local_date)
values ('99999999-9999-9999-9999-999999999999', 'c2000000-0000-0000-0000-000000000001', pg_temp.today() - 10);
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', true);
set local role authenticated;

do $$
declare r jsonb; i int;
begin
  for i in 1..3 loop
    r := public.log_habit(('c2000000-0000-0000-0000-00000000000' || i)::uuid, pg_temp.today());
  end loop;
  perform pg_temp.check(not (r->'titles_granted' ? 'fenix'), 'Fênix só com o dia perfeito');

  r := public.log_habit('c2000000-0000-0000-0000-000000000004', pg_temp.today());
  perform pg_temp.check((r->>'perfect_day_bonus')::int > 0, 'dia perfeito');
  perform pg_temp.check(r->'titles_granted' ? 'fenix', 'Fênix: dia perfeito após 10 dias parada');
  perform pg_temp.check(r->'titles_granted' ? 'equilibrio-perfeito', 'Equilíbrio: 4 áreas no dia perfeito');

  -- objetivo com poucos registros ainda não pode ser conquistado
  begin
    perform public.complete_objective('c1000000-0000-0000-0000-000000000001');
    raise exception 'FALHOU: conquistou objetivo com 2 registros';
  exception when sqlstate 'PR006' then null;
  end;
  -- objetivo de outra pessoa não existe para ela
  begin
    perform public.complete_objective('b0000000-0000-0000-0000-000000000001');
    raise exception 'FALHOU: conquistou objetivo de outro usuário';
  exception when no_data_found then null;
  end;
  perform pg_temp.check((select count(*) from public.my_objectives_progress()) = 4, '4 objetivos ativos');
end $$;

-- mais 8 registros antigos em Saúde (10 no total)
reset role;
insert into public.habit_logs (user_id, habit_id, local_date)
select '99999999-9999-9999-9999-999999999999', 'c2000000-0000-0000-0000-000000000001', pg_temp.today() - d
from generate_series(11, 18) d;
set local role authenticated;

do $$
declare r jsonb; v_before int;
begin
  v_before := public.my_coin_balance();
  r := public.complete_objective('c1000000-0000-0000-0000-000000000001');
  perform pg_temp.check(r->>'title' = 'conquista-health' and (r->>'title_new')::boolean, 'título épico da área');
  perform pg_temp.check(public.my_coin_balance() = v_before + 100, '+100 Cristais pelo objetivo');
  perform pg_temp.check((select status from public.objectives where id = 'c1000000-0000-0000-0000-000000000001') = 'done', 'objetivo concluído');
  perform pg_temp.check((select count(*) from public.my_objectives_progress()) = 3, 'sai da lista de ativos');
  begin
    perform public.complete_objective('c1000000-0000-0000-0000-000000000001');
    raise exception 'FALHOU: conquistou o mesmo objetivo duas vezes';
  exception when invalid_parameter_value then null;
  end;
  update public.profiles set equipped_title = 'conquista-health';
  perform pg_temp.check((select equipped_title from public.profiles) = 'conquista-health', 'exibe o título épico');
end $$;

-- ── Caminho, promoções e missão relâmpago ────────────────────
-- Gil: nível 5, Marcial estágio 0, 2 missões em Saúde.
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
set local role authenticated;

do $$
declare r jsonb;
begin
  r := public.my_hero_path();
  perform pg_temp.check((r->>'area_missions')::int = 2, '2 missões em Saúde');
  perform pg_temp.check(not (r->>'can_promote')::boolean, 'estágio 1 pede 10 missões');
  begin
    perform public.promote_hero();
    raise exception 'FALHOU: promoveu sem os requisitos';
  exception when sqlstate 'PR014' then null;
  end;
end $$;

-- mais 8 missões antigas em Saúde (10 no total)
reset role;
insert into public.habits (id, user_id, objective_id, title, difficulty, start_date) values
  ('b1000000-0000-0000-0000-000000000003', '88888888-8888-8888-8888-888888888888',
   'b0000000-0000-0000-0000-000000000001', 'Treino antigo', 'hard', pg_temp.today() - 200);
insert into public.habit_logs (user_id, habit_id, local_date)
select '88888888-8888-8888-8888-888888888888', 'b1000000-0000-0000-0000-000000000003', pg_temp.today() - d
from generate_series(2, 9) d;
set local role authenticated;

do $$
declare r jsonb;
begin
  r := public.my_hero_path();
  perform pg_temp.check((r->>'can_promote')::boolean, 'nível 5 + 10 missões: promoção liberada');
  r := public.promote_hero();
  perform pg_temp.check((r->>'stage')::int = 1, 'promovido ao estágio 1');
  perform pg_temp.check(
    (select count(*) from public.hero_history where event = 'promote' and stage = 1) = 1, 'promoção no histórico');
  begin
    perform public.promote_hero();
    raise exception 'FALHOU: promoveu ao estágio 2 no nível 5';
  exception when sqlstate 'PR014' then null;
  end;
end $$;

-- nível 20 e 120 missões em Saúde (só o backend grava XP)
reset role;
insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
values ('88888888-8888-8888-8888-888888888888', 18000, 'habit', pg_temp.today() - 30, 'seed:gil-nivel-20');
insert into public.habit_logs (user_id, habit_id, local_date)
select '88888888-8888-8888-8888-888888888888', 'b1000000-0000-0000-0000-000000000003', pg_temp.today() - d
from generate_series(10, 119) d;
-- arquivado ontem: os registros continuam contando, mas ele sai da agenda de hoje
update public.habits set archived_on = pg_temp.today() - 1 where id = 'b1000000-0000-0000-0000-000000000003';
set local role authenticated;

do $$
declare r jsonb;
begin
  r := public.promote_hero();
  perform pg_temp.check((r->>'stage')::int = 2, 'estágio 2');
  r := public.my_hero_path();
  perform pg_temp.check((r->>'needs_branch')::boolean, 'o estágio 3 pede o ramo');
  begin
    perform public.promote_hero();
    raise exception 'FALHOU: promoveu ao estágio 3 sem ramo';
  exception when sqlstate 'PR015' then null;
  end;
  r := public.promote_hero('B');
  perform pg_temp.check((r->>'stage')::int = 3 and r->>'branch' = 'B', 'estágio 3 no ramo B');
  begin
    perform public.promote_hero();
    raise exception 'FALHOU: promoveu ao estágio 4 no nível 20';
  exception when sqlstate 'PR014' then null;
  end;

  -- trocar de ramo mantém o estágio e inicia a espera de 14 dias
  r := public.choose_path('marcial', 'A');
  perform pg_temp.check((r->>'stage')::int = 3 and r->>'branch' = 'A', 'troca para o ramo A no mesmo estágio');
  perform pg_temp.check((select path_changed_at from public.profiles) is not null, 'troca inicia a espera');
  r := public.choose_path('marcial', 'A');
  perform pg_temp.check(not (r->>'changed')::boolean, 'escolher o mesmo não conta como troca');
  begin
    perform public.choose_path('arcano');
    raise exception 'FALHOU: trocou de caminho durante a espera';
  exception when sqlstate 'PR011' then null;
  end;
  begin
    perform public.choose_path('pirata');
    raise exception 'FALHOU: aceitou caminho inexistente';
  exception when no_data_found then null;
  end;
end $$;

-- passaram 15 dias desde a troca
reset role;
select set_config('per.hero_progress', 'on', true);
update public.profiles set path_changed_at = now() - interval '15 days'
where id = '88888888-8888-8888-8888-888888888888';
select set_config('per.hero_progress', 'off', true);
set local role authenticated;

do $$
declare r jsonb;
begin
  -- Arcano: nenhuma missão em Conhecimento → recomeça no estágio 0 (o nível continua 20)
  r := public.choose_path('arcano');
  perform pg_temp.check((r->>'stage')::int = 0 and r->>'branch' is null, 'novo caminho recalcula o estágio');
  r := public.my_hero_path();
  perform pg_temp.check((r->>'level')::int = 20, 'o nível não muda');
  perform pg_temp.check(r->>'change_available_at' is not null, 'nova espera após a troca');
end $$;

-- vantagens do caminho (lidas pelo backend em log_habit)
reset role;
select set_config('per.hero_progress', 'on', true);
update public.profiles set path = 'destreza', branch = 'B', stage = 2
where id = '88888888-8888-8888-8888-888888888888';
do $$ begin
  perform pg_temp.check(not (select yesterday_full from public.hero_perks('88888888-8888-8888-8888-888888888888')),
    'Destreza B: Cristais cheios de ontem só a partir do estágio 3');
end $$;
update public.profiles set stage = 3 where id = '88888888-8888-8888-8888-888888888888';
do $$ begin
  perform pg_temp.check((select yesterday_full from public.hero_perks('88888888-8888-8888-8888-888888888888')),
    'Destreza B no estágio 3: Cristais cheios de ontem');
  perform pg_temp.check((select area_pct from public.hero_perks('88888888-8888-8888-8888-888888888888')) = 12,
    'estágio 3: +12% na área');
end $$;
update public.profiles set path = 'natureza', branch = null, stage = 0
where id = '88888888-8888-8888-8888-888888888888';
do $$ begin
  perform pg_temp.check((select easy_extra from public.hero_perks('88888888-8888-8888-8888-888888888888')) = 2,
    'Natureza: +2 Cristais por missão fácil');
end $$;
select set_config('per.hero_progress', 'off', true);

-- Missão relâmpago: Gil ganha um hábito novo; é a única missão de hoje ainda não feita
insert into public.habits (id, user_id, title, difficulty, start_date) values
  ('b1000000-0000-0000-0000-000000000004', '88888888-8888-8888-8888-888888888888', 'Meditar', 'medium', pg_temp.today() - 1);
set local role authenticated;

do $$
declare r jsonb; v_log uuid;
begin
  r := public.my_flash_mission();
  perform pg_temp.check(r->>'habit_id' = 'b1000000-0000-0000-0000-000000000004', 'sorteia a missão ainda não feita');
  perform pg_temp.check(not (r->>'done')::boolean, 'ainda não feita');
  perform pg_temp.check((r->>'deadline')::timestamptz between now() and now() + interval '4 hours', 'prazo de até 4 horas (sem passar da meia-noite)');
  perform pg_temp.check(public.my_flash_mission()->>'habit_id' = r->>'habit_id', 'o sorteio fica fixo no dia');

  -- média (20 XP) dentro do prazo: +50% = 10 XP e +10 Cristais
  r := public.log_habit('b1000000-0000-0000-0000-000000000004', pg_temp.today());
  perform pg_temp.check((r->>'flash_bonus')::int = 10, 'relâmpago: +50% do XP');
  select id into v_log from public.habit_logs
  where habit_id = 'b1000000-0000-0000-0000-000000000004' and local_date = pg_temp.today();
  perform pg_temp.check(exists (select 1 from public.coin_transactions where idempotency_key = 'coins:flash:' || v_log),
    'relâmpago: +10 Cristais');
  perform pg_temp.check((public.my_flash_mission()->>'done')::boolean, 'relâmpago concluída');
  perform pg_temp.check((public.my_flash_mission()->>'awarded')::boolean, 'bônus relâmpago concedido');

  -- desfazer estorna o bônus relâmpago (XP e Cristais)
  perform public.undo_habit_log('b1000000-0000-0000-0000-000000000004', pg_temp.today());
  perform pg_temp.check(exists (select 1 from public.xp_transactions where idempotency_key = 'reversal:flash:' || v_log),
    'estorna o XP relâmpago');
  perform pg_temp.check(exists (select 1 from public.coin_transactions where idempotency_key = 'reversal:coins:flash:' || v_log),
    'estorna os Cristais relâmpago');

  -- o app não grava a missão relâmpago direto
  begin
    update public.flash_missions set deadline = now() + interval '1 day';
    raise exception 'FALHOU: estendeu o prazo direto';
  exception when insufficient_privilege then null;
  end;
end $$;

-- prazo vencido: concluir não dá bônus
reset role;
update public.flash_missions set deadline = now() - interval '1 minute'
where user_id = '88888888-8888-8888-8888-888888888888';
set local role authenticated;

do $$
declare r jsonb;
begin
  r := public.log_habit('b1000000-0000-0000-0000-000000000004', pg_temp.today());
  perform pg_temp.check((r->>'flash_bonus')::int = 0, 'fora do prazo, sem bônus');
  perform pg_temp.check(
    (public.my_flash_mission()->>'done')::boolean and not (public.my_flash_mission()->>'awarded')::boolean,
    'concluída fora do prazo: feita, mas sem bônus');
end $$;

-- Bia não vê o caminho nem a missão relâmpago de Gil
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.hero_history) = 0, 'B não vê o histórico do herói de Gil');
  perform pg_temp.check((select count(*) from public.flash_missions) = 0, 'B não vê a missão relâmpago de Gil');
  perform pg_temp.check((public.my_hero_path()->>'path') is null, 'B ainda não escolheu caminho');
end $$;

-- ── Tour e feedback ──────────────────────────────────────────
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
set local role authenticated;

do $$ begin
  update public.profiles set tour_seen_at = now(), tour_seen_version = 1;
  perform pg_temp.check((select tour_seen_at from public.profiles) is not null, 'marca o tour como visto');
  perform pg_temp.check(
    (select value from public.app_settings where key = 'tour_version') = 1, 'versão do tour é pública');
  begin
    update public.app_settings set value = 99 where key = 'tour_version';
    raise exception 'FALHOU: usuário mudou a versão do tour';
  exception when insufficient_privilege then null;
  end;

  insert into public.feedback (kind, message, app_version, platform) values ('bug', 'O herói some ao rolar', '0.1.0', 'android');
  perform pg_temp.check((select count(*) from public.feedback) = 1, 'envia e lê o próprio feedback');
  perform pg_temp.check((select user_id from public.feedback) = '88888888-8888-8888-8888-888888888888', 'feedback fica no nome de quem enviou');

  begin
    insert into public.feedback (user_id, kind, message) values ('22222222-2222-2222-2222-222222222222', 'ideia', 'em nome de outra pessoa');
    raise exception 'FALHOU: enviou feedback em nome de outro usuário';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feedback (kind, message) values ('ideia', '  ');
    raise exception 'FALHOU: aceitou feedback vazio';
  exception when check_violation then null;
  end;
  begin
    insert into public.feedback (kind, message) values ('reclamacao', 'tipo desconhecido');
    raise exception 'FALHOU: aceitou tipo desconhecido';
  exception when check_violation then null;
  end;
  begin
    update public.feedback set message = 'editado';
    raise exception 'FALHOU: editou feedback enviado';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.feedback) = 0, 'B não lê o feedback de Gil');
end $$;

reset role;
set local role anon;
do $$ begin
  begin
    insert into public.feedback (kind, message) values ('bug', 'sem login');
    raise exception 'FALHOU: visitante enviou feedback';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Escudos de streak ────────────────────────────────────────
-- Ivo: um hábito diário há 10 dias; fez tudo menos há 3 dias; tem 200 Cristais.
reset role;
insert into auth.users (id, email) values ('aaaaaaaa-1111-1111-1111-111111111111', 'ivo@teste.dev');
update public.profiles set timezone = 'America/Manaus' where id = 'aaaaaaaa-1111-1111-1111-111111111111';
insert into public.habits (id, user_id, title, start_date) values
  ('aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-111111111111', 'Alongar', pg_temp.today() - 10);
insert into public.habit_logs (user_id, habit_id, local_date)
select 'aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222', pg_temp.today() - d
from generate_series(1, 10) d where d <> 3;
insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
values ('aaaaaaaa-1111-1111-1111-111111111111', 200, 'level_up', pg_temp.today(), 'seed:ivo-coins');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', true);
set local role authenticated;

do $$
declare r jsonb;
begin
  r := public.my_streak_shields();
  perform pg_temp.check((r->>'held')::int = 0 and (r->>'max')::int = 2 and (r->>'price')::int = 60, 'sem escudos; limite 2; preço 60');
  begin
    perform public.use_streak_shield(pg_temp.today() - 3);
    raise exception 'FALHOU: usou escudo sem ter';
  exception when sqlstate 'PR022' then null;
  end;

  r := public.buy_streak_shield();
  perform pg_temp.check((r->>'held')::int = 1 and (r->>'coin_balance')::int = 140, 'compra 1 escudo por 60');
  r := public.buy_streak_shield();
  perform pg_temp.check((r->>'held')::int = 2, 'compra o 2º escudo');
  begin
    perform public.buy_streak_shield();
    raise exception 'FALHOU: passou do limite de escudos';
  exception when sqlstate 'PR020' then null;
  end;

  r := public.use_streak_shield(pg_temp.today() - 3);
  perform pg_temp.check((r->>'used')::boolean and (r->>'held')::int = 1, 'escudo protege o dia perdido');
  r := public.use_streak_shield(pg_temp.today() - 3);
  perform pg_temp.check(not (r->>'used')::boolean and (r->>'held')::int = 1, 'repetir o dia não gasta outro escudo');
  perform pg_temp.check(
    (public.my_streak_shields()->'used_dates') @> to_jsonb(array[(pg_temp.today() - 3)::text]), 'dia protegido aparece na lista');

  begin
    perform public.use_streak_shield(pg_temp.today() - 1);
    raise exception 'FALHOU: usou escudo em dia que ainda aceita registro';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.use_streak_shield(pg_temp.today() - 9);
    raise exception 'FALHOU: usou escudo fora da janela de 7 dias';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.use_streak_shield(pg_temp.today() - 4);
    raise exception 'FALHOU: usou escudo em dia completo';
  exception when sqlstate 'PR021' then null;
  end;
  begin
    insert into public.streak_shield_uses (user_id, local_date) values ('aaaaaaaa-1111-1111-1111-111111111111', pg_temp.today() - 5);
    raise exception 'FALHOU: gravou escudo direto';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.streak_shield_uses) = 0, 'B não vê os escudos de Ivo');
end $$;

-- ── Loja: cosméticos e recompensas ───────────────────────────
-- Ivo tem 80 Cristais (200 − 2 escudos de 60).
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', true);
set local role authenticated;

do $$ begin
  perform pg_temp.check(public.my_coin_balance() = 80, 'Ivo começa com 80 Cristais');
  begin
    perform public.buy_cosmetic('loja-cabelo-rosa');
    raise exception 'FALHOU: comprou cabelo de 100 com 80';
  exception when sqlstate 'PR004' then null;
  end;
  perform pg_temp.check(not exists (select 1 from public.user_cosmetics), 'compra recusada não deixa rastro');
end $$;

-- mais Cristais (só o backend grava)
reset role;
insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
values ('aaaaaaaa-1111-1111-1111-111111111111', 300, 'level_up', pg_temp.today(), 'seed:ivo-loja');
set local role authenticated;

do $$
declare r jsonb; v_reward uuid;
begin
  r := public.buy_cosmetic('loja-cabelo-rosa');
  perform pg_temp.check((r->>'coin_balance')::int = 280, 'cabelo rosa por 100 (380 → 280)');
  perform pg_temp.check(exists (select 1 from public.user_cosmetics where item_id = 'loja-cabelo-rosa'), 'cosmético na conta');
  begin
    perform public.buy_cosmetic('loja-cabelo-rosa');
    raise exception 'FALHOU: comprou o mesmo cosmético duas vezes';
  exception when sqlstate 'PR002' then null;
  end;
  begin
    perform public.buy_cosmetic('loja-dragao');
    raise exception 'FALHOU: comprou item inexistente';
  exception when no_data_found then null;
  end;
  begin
    insert into public.user_cosmetics (user_id, item_id) values ('aaaaaaaa-1111-1111-1111-111111111111', 'loja-aura-sombra');
    raise exception 'FALHOU: ganhou cosmético direto';
  exception when insufficient_privilege then null;
  end;

  -- recompensas: o usuário cria, edita e resgata
  insert into public.custom_rewards (title, emoji, price) values ('Ver um episódio', '🎬', 50) returning id into v_reward;
  update public.custom_rewards set price = 60 where id = v_reward;
  r := public.redeem_reward(v_reward);
  perform pg_temp.check((r->>'coin_balance')::int = 220, 'resgate desconta 60 (280 → 220)');
  perform pg_temp.check(
    (select count(*) from public.reward_redemptions where title = 'Ver um episódio' and price = 60) = 1,
    'resgate no histórico');
  begin
    insert into public.custom_rewards (title, price) values ('Barato demais', 1);
    raise exception 'FALHOU: aceitou preço abaixo do mínimo';
  exception when check_violation then null;
  end;
  begin
    insert into public.custom_rewards (user_id, title, price) values ('22222222-2222-2222-2222-222222222222', 'De outro', 50);
    raise exception 'FALHOU: criou recompensa para outro usuário';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.reward_redemptions (user_id, title, price) values ('aaaaaaaa-1111-1111-1111-111111111111', 'grátis', 0);
    raise exception 'FALHOU: gravou resgate direto';
  exception when insufficient_privilege then null;
  end;

  -- recompensa cara demais para o saldo
  insert into public.custom_rewards (title, price) values ('Viagem', 5000) returning id into v_reward;
  begin
    perform public.redeem_reward(v_reward);
    raise exception 'FALHOU: resgatou sem Cristais';
  exception when sqlstate 'PR004' then null;
  end;

  -- apagar a recompensa mantém o histórico
  delete from public.custom_rewards where title = 'Ver um episódio';
  perform pg_temp.check(
    (select reward_id from public.reward_redemptions where title = 'Ver um episódio') is null, 'histórico fica sem o vínculo');
end $$;

-- guarda o id de uma recompensa de Ivo para tentar resgatá-la como Bia
reset role;
select set_config('test.ivo_reward', (select id::text from public.custom_rewards where title = 'Viagem'), true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.custom_rewards) = 0, 'B não vê as recompensas de Ivo');
  perform pg_temp.check((select count(*) from public.user_cosmetics) = 0, 'B não vê os cosméticos de Ivo');
  begin
    perform public.redeem_reward(current_setting('test.ivo_reward')::uuid);
    raise exception 'FALHOU: B resgatou recompensa de outro';
  exception when no_data_found then null;
  end;
  update public.custom_rewards set price = 5 where id = current_setting('test.ivo_reward')::uuid;
end $$;

reset role;
do $$ begin
  perform pg_temp.check(
    (select price from public.custom_rewards where id = current_setting('test.ivo_reward')::uuid) = 5000,
    'B não edita recompensa de outro');
end $$;

-- ── Tipos de hábito: evitar e contador ──────────────────────
select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.habits (id, title, kind, target_qty, unit, start_date) values
  ('aaaaaaaa-3333-3333-3333-333333333333', 'Beber água', 'count', 3, 'copos', pg_temp.today() - 1);
insert into public.habits (id, title, kind, start_date) values
  ('aaaaaaaa-4444-4444-4444-444444444444', 'Não fumar', 'avoid', pg_temp.today());

do $$
declare
  r jsonb;
  xp0 integer := public.my_total_xp();
begin
  begin
    insert into public.habits (title, kind, start_date) values ('Sem meta', 'count', pg_temp.today());
    raise exception 'FALHOU: contador sem meta';
  exception when check_violation then null;
  end;
  begin
    insert into public.habits (title, kind, target_qty, start_date) values ('Meta quebrada', 'count', 2.5, pg_temp.today());
    raise exception 'FALHOU: contador com meta fracionada';
  exception when check_violation then null;
  end;
  begin
    insert into public.habit_counts (user_id, habit_id, local_date, qty)
    values ('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), 3);
    raise exception 'FALHOU: app gravou contagem direto';
  exception when insufficient_privilege then null;
  end;

  r := public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), 1);
  perform pg_temp.check((r->>'done')::boolean = false and r->'log' = 'null'::jsonb, '1 de 3 ainda não conclui');
  perform pg_temp.check(public.my_total_xp() = xp0, 'progresso parcial não dá XP');
  perform pg_temp.check(not exists (select 1 from public.habit_logs where habit_id = 'aaaaaaaa-3333-3333-3333-333333333333'),
    'progresso parcial não cria registro');

  r := public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), 3);
  perform pg_temp.check((r->>'done')::boolean and (r->'log'->>'logged')::boolean, 'bater a meta conclui a missão');
  perform pg_temp.check(public.my_total_xp() > xp0, 'bater a meta dá o XP (via log_habit)');

  r := public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), 4);
  perform pg_temp.check(r->'log' = 'null'::jsonb, 'passar da meta não dá XP de novo');
  perform pg_temp.check((select qty from public.habit_logs where habit_id = 'aaaaaaaa-3333-3333-3333-333333333333') = 4,
    'registro guarda a contagem');

  r := public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), 2);
  perform pg_temp.check((r->'undo'->>'undone')::boolean, 'baixar da meta desfaz a missão');
  perform pg_temp.check(public.my_total_xp() = xp0, 'desfazer estorna o XP');
  perform pg_temp.check((select qty from public.habit_counts where habit_id = 'aaaaaaaa-3333-3333-3333-333333333333') = 2,
    'contagem parcial fica salva');

  r := public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today() - 1, 3);
  perform pg_temp.check((r->>'done')::boolean, 'contador também vale para ontem');
  begin
    perform public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today() - 2, 3);
    raise exception 'FALHOU: contou fora da janela';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), -1);
    raise exception 'FALHOU: contagem negativa';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_habit_count('aaaaaaaa-4444-4444-4444-444444444444', pg_temp.today(), 1);
    raise exception 'FALHOU: contou hábito que não é contador';
  exception when invalid_parameter_value then null;
  end;

  r := public.log_habit('aaaaaaaa-4444-4444-4444-444444444444', pg_temp.today());
  perform pg_temp.check((r->>'logged')::boolean, 'hábito a evitar conclui com um toque');
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.habit_counts) = 0, 'B não vê as contagens de Ivo');
  begin
    perform public.set_habit_count('aaaaaaaa-3333-3333-3333-333333333333', pg_temp.today(), 3);
    raise exception 'FALHOU: B contou hábito de outro';
  exception when no_data_found then null;
  end;
end $$;

-- ── Desafios: jornadas e chefe da semana ────────────────────
-- Juca: Meditar (feito de −25 a −5), Correr (nunca feito), Ler e Alongar (novos).
reset role;
insert into auth.users (id, email) values ('bbbbbbbb-1111-1111-1111-111111111111', 'juca@teste.dev');
update public.profiles set timezone = 'America/Manaus' where id = 'bbbbbbbb-1111-1111-1111-111111111111';
insert into public.habits (id, user_id, title, start_date) values
  ('bbbbbbbb-2222-2222-2222-222222222221', 'bbbbbbbb-1111-1111-1111-111111111111', 'Meditar', pg_temp.today() - 40),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-1111-1111-1111-111111111111', 'Correr', pg_temp.today() - 40),
  ('bbbbbbbb-2222-2222-2222-222222222223', 'bbbbbbbb-1111-1111-1111-111111111111', 'Ler', pg_temp.today()),
  ('bbbbbbbb-2222-2222-2222-222222222224', 'bbbbbbbb-1111-1111-1111-111111111111', 'Alongar', pg_temp.today());
insert into public.habit_logs (user_id, habit_id, local_date)
select 'bbbbbbbb-1111-1111-1111-111111111111', 'bbbbbbbb-2222-2222-2222-222222222221', pg_temp.today() - d
from generate_series(5, 25) d;
-- jornadas que começaram no passado (o app só começa hoje, via start_journey)
insert into public.journeys (id, user_id, habit_id, length_days, start_date) values
  ('bbbbbbbb-3333-3333-3333-333333333331', 'bbbbbbbb-1111-1111-1111-111111111111',
   'bbbbbbbb-2222-2222-2222-222222222221', 21, pg_temp.today() - 25),
  ('bbbbbbbb-3333-3333-3333-333333333332', 'bbbbbbbb-1111-1111-1111-111111111111',
   'bbbbbbbb-2222-2222-2222-222222222222', 21, pg_temp.today() - 20);
-- semana passada inteira feita (Meditar e Correr agendados todo dia → 14 missões, vida 12)
insert into public.habit_logs (user_id, habit_id, local_date)
select 'bbbbbbbb-1111-1111-1111-111111111111', h, date_trunc('week', pg_temp.today())::date - 7 + d
from generate_series(0, 6) d,
     unnest(array['bbbbbbbb-2222-2222-2222-222222222221', 'bbbbbbbb-2222-2222-2222-222222222222']::uuid[]) h
on conflict (habit_id, local_date) do nothing;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-1111-1111-1111-111111111111', true);
set local role authenticated;

do $$
declare
  r jsonb;
  coins0 integer := (select coalesce(sum(amount), 0) from public.coin_transactions);
begin
  begin
    insert into public.journeys (user_id, habit_id, length_days, start_date)
    values ('bbbbbbbb-1111-1111-1111-111111111111', 'bbbbbbbb-2222-2222-2222-222222222223', 21, pg_temp.today() - 30);
    raise exception 'FALHOU: app criou jornada direto';
  exception when insufficient_privilege then null;
  end;

  r := public.resolve_journey('bbbbbbbb-3333-3333-3333-333333333331');
  perform pg_temp.check(r->>'status' = 'won' and (r->>'coins_awarded')::int = 120, 'jornada de 21 dias vencida rende 120');
  r := public.resolve_journey('bbbbbbbb-3333-3333-3333-333333333331');
  perform pg_temp.check((select coalesce(sum(amount), 0) from public.coin_transactions) = coins0 + 120,
    'resolver de novo não paga outra vez');

  r := public.resolve_journey('bbbbbbbb-3333-3333-3333-333333333332');
  perform pg_temp.check(r->>'status' = 'lost', 'faltas demais perdem a jornada antes do fim');

  r := public.start_journey('bbbbbbbb-2222-2222-2222-222222222223', 21);
  perform pg_temp.check(
    (select start_date from public.journeys where id = (r->>'id')::uuid) = pg_temp.today(), 'jornada começa hoje');
  perform pg_temp.check(public.resolve_journey((r->>'id')::uuid)->>'status' = 'active', 'jornada nova segue ativa');
  begin
    perform public.start_journey('bbbbbbbb-2222-2222-2222-222222222223', 66);
    raise exception 'FALHOU: duas jornadas no mesmo hábito';
  exception when sqlstate 'PR030' then null;
  end;
  begin
    perform public.start_journey('bbbbbbbb-2222-2222-2222-222222222224', 30);
    raise exception 'FALHOU: duração inválida';
  exception when invalid_parameter_value then null;
  end;
  perform public.start_journey('bbbbbbbb-2222-2222-2222-222222222224', 66);
  perform public.start_journey('bbbbbbbb-2222-2222-2222-222222222221', 21); -- a anterior foi vencida
  begin
    perform public.start_journey('bbbbbbbb-2222-2222-2222-222222222222', 21);
    raise exception 'FALHOU: passou do limite de jornadas';
  exception when sqlstate 'PR031' then null;
  end;
  perform public.abandon_journey((r->>'id')::uuid);
  perform pg_temp.check((select status from public.journeys where id = (r->>'id')::uuid) = 'abandoned', 'abandona a jornada');

  -- chefe da semana passada derrotado
  r := public.claim_weekly_boss(date_trunc('week', pg_temp.today())::date - 7);
  perform pg_temp.check((r->>'claimed')::boolean and (r->>'coins_awarded')::int = 40, 'chefe derrotado rende 40');
  r := public.claim_weekly_boss(date_trunc('week', pg_temp.today())::date - 7);
  perform pg_temp.check(not (r->>'claimed')::boolean, 'chefe só paga uma vez');
  begin
    perform public.claim_weekly_boss(date_trunc('week', pg_temp.today())::date - 14);
    raise exception 'FALHOU: resgatou chefe antigo';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- o chefe desta semana ainda está de pé (precisa de missões em dias que ainda não chegaram)
reset role;
delete from public.habit_logs where user_id = 'bbbbbbbb-1111-1111-1111-111111111111'
  and local_date >= date_trunc('week', pg_temp.today())::date;
set local role authenticated;
do $$ begin
  begin
    perform public.claim_weekly_boss(date_trunc('week', pg_temp.today())::date);
    raise exception 'FALHOU: resgatou chefe não derrotado';
  exception when sqlstate 'PR032' then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.journeys) = 0, 'B não vê as jornadas de Juca');
  begin
    perform public.resolve_journey('bbbbbbbb-3333-3333-3333-333333333332');
    raise exception 'FALHOU: B resolveu jornada de outro';
  exception when no_data_found then null;
  end;
  begin
    perform public.abandon_journey('bbbbbbbb-3333-3333-3333-333333333332');
    raise exception 'FALHOU: B abandonou jornada de outro';
  exception when no_data_found then null;
  end;
end $$;

-- ── Social: amigos e grupos ─────────────────────────────────
-- Lia (sem hábitos) e Mel (um hábito diário secreto, feito nos últimos 20 dias).
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('cccccccc-1111-1111-1111-111111111111', 'lia@teste.dev', '{"display_name":"Lia"}'),
  ('dddddddd-1111-1111-1111-111111111111', 'mel@teste.dev', '{"display_name":"Mel"}');
update public.profiles set timezone = 'America/Manaus'
where id in ('cccccccc-1111-1111-1111-111111111111', 'dddddddd-1111-1111-1111-111111111111');
update public.profiles set display_name = 'Juca' where id = 'bbbbbbbb-1111-1111-1111-111111111111';
insert into public.habits (id, user_id, title, start_date) values
  ('dddddddd-2222-2222-2222-222222222222', 'dddddddd-1111-1111-1111-111111111111', 'Segredo da Mel', pg_temp.today() - 30);
insert into public.habit_logs (user_id, habit_id, local_date)
select 'dddddddd-1111-1111-1111-111111111111', 'dddddddd-2222-2222-2222-222222222222', pg_temp.today() - d
from generate_series(1, 20) d;
select set_config('test.mel_code', (select friend_code from public.profiles where id = 'dddddddd-1111-1111-1111-111111111111'), true);
select set_config('test.lia_code', (select friend_code from public.profiles where id = 'cccccccc-1111-1111-1111-111111111111'), true);
do $$ begin
  perform pg_temp.check(current_setting('test.mel_code') ~ '^[A-HJ-NP-Z2-9]{6}$', 'código de amigo com 6 letras sem ambíguas');
  perform pg_temp.check(public.user_streak('dddddddd-1111-1111-1111-111111111111') = 20, 'streak no banco segue as regras do app');
end $$;

select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
declare r jsonb;
begin
  begin
    update public.profiles set friend_code = 'AAAAAA' where id = 'cccccccc-1111-1111-1111-111111111111';
    raise exception 'FALHOU: trocou o código de amigo';
  exception when sqlstate 'PR045' then null;
  end;
  begin
    perform public.send_friend_request(current_setting('test.lia_code'));
    raise exception 'FALHOU: pediu amizade a si mesma';
  exception when sqlstate 'PR040' then null;
  end;
  begin
    perform public.send_friend_request('ZZZZZZ');
    raise exception 'FALHOU: código inexistente';
  exception when no_data_found then null;
  end;
  begin
    insert into public.friendships (requester, addressee)
    values ('cccccccc-1111-1111-1111-111111111111', 'dddddddd-1111-1111-1111-111111111111');
    raise exception 'FALHOU: app criou amizade direto';
  exception when insufficient_privilege then null;
  end;

  r := public.send_friend_request(lower(substr(current_setting('test.mel_code'), 1, 3) || '-' || substr(current_setting('test.mel_code'), 4)));
  perform pg_temp.check(r->>'status' = 'pending', 'código com hífen e minúsculas vira pedido pendente');
  r := public.my_friends();
  perform pg_temp.check(jsonb_array_length(r->'outgoing') = 1 and jsonb_array_length(r->'friends') = 0,
    'pedido aparece como enviado, ainda sem amizade');
  perform pg_temp.check(not (r::text like '%"streak"%'), 'pedido pendente não mostra o resumo');
end $$;

select set_config('request.jwt.claim.sub', 'dddddddd-1111-1111-1111-111111111111', true);
do $$
declare r jsonb;
begin
  r := public.my_friends();
  perform pg_temp.check(jsonb_array_length(r->'incoming') = 1, 'Mel recebe o pedido');
  perform public.respond_friend_request((r->'incoming'->0->>'request_id')::uuid, true);
  update public.profiles set discoverable = false where id = 'dddddddd-1111-1111-1111-111111111111';
end $$;

select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
do $$
declare r jsonb; f jsonb;
begin
  r := public.my_friends();
  f := r->'friends'->0;
  perform pg_temp.check(f->>'display_name' = 'Mel' and (f->>'streak')::int = 20
    and (f->>'today_total')::int = 1 and (f->>'today_done')::int = 0 and (f->>'level')::int >= 1,
    'amiga vê nome, streak, nível e missões de hoje');
  perform pg_temp.check(not (r::text like '%Segredo%'), 'nomes dos hábitos não aparecem para amigos');
  perform pg_temp.check((select count(*) from public.habits) = 0, 'RLS: Lia não lê os hábitos de Mel');
  begin
    perform public.send_friend_request(current_setting('test.mel_code'));
    raise exception 'FALHOU: pediu amizade a quem já é amiga';
  exception when sqlstate 'PR041' then null;
  end;

  -- busca: Mel desligou a busca; Juca aparece
  perform pg_temp.check(jsonb_array_length(public.search_users('Me')) = 0, 'quem desliga a busca não aparece');
  r := public.search_users('  juc ');
  perform pg_temp.check(jsonb_array_length(r) = 1 and r->0->'user'->>'display_name' = 'Juca'
    and r->0->'relation' = 'null'::jsonb and not (r::text like '%"streak"%'), 'busca acha Juca, só com o cartão curto');
  perform pg_temp.check(jsonb_array_length(public.search_users('%%')) = 0, 'curinga do LIKE é tratado como texto');
  begin
    perform public.search_users('j');
    raise exception 'FALHOU: busca com 1 letra';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.send_friend_request(p_user => 'dddddddd-1111-1111-1111-111111111111');
    raise exception 'FALHOU: pediu pela busca a quem não aparece nela';
  exception when no_data_found then null;
  end;
  r := public.send_friend_request(p_user => 'bbbbbbbb-1111-1111-1111-111111111111');
  perform pg_temp.check(r->>'status' = 'pending', 'pedido pela busca');
  perform pg_temp.check(public.search_users('Juca')->0->>'relation' = 'pending_out', 'busca mostra pedido enviado');
end $$;

-- Juca pede de volta: vira amizade na hora; depois desfaz
select set_config('request.jwt.claim.sub', 'bbbbbbbb-1111-1111-1111-111111111111', true);
do $$
declare r jsonb;
begin
  r := public.send_friend_request(current_setting('test.lia_code'));
  perform pg_temp.check(r->>'status' = 'accepted', 'pedido cruzado vira amizade');
  perform public.remove_friend('cccccccc-1111-1111-1111-111111111111');
  perform pg_temp.check(jsonb_array_length(public.my_friends()->'friends') = 0, 'desfaz a amizade');
end $$;

-- Grupos: Lia cria, Mel entra; o chefe soma as missões das duas
select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
do $$
declare r jsonb;
begin
  r := public.create_group('  Time   da manhã ');
  perform set_config('test.group', r->>'id', true);
  perform set_config('test.group_code', (select invite_code from public.groups where id = (r->>'id')::uuid), true);
  perform pg_temp.check((select name from public.groups) = 'Time da manhã', 'grupo criado com o nome limpo');
  begin
    perform public.create_group('   ');
    raise exception 'FALHOU: grupo sem nome';
  exception when invalid_parameter_value then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'dddddddd-1111-1111-1111-111111111111', true);
do $$ begin
  perform public.join_group(current_setting('test.group_code'));
  perform public.join_group(current_setting('test.group_code')); -- de novo: nada muda
  perform pg_temp.check((select count(*) from public.group_members) = 2, 'Mel entra no grupo uma vez');
end $$;

select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
do $$
declare r jsonb; v_last date := date_trunc('week', pg_temp.today())::date - 7;
begin
  r := public.group_detail(current_setting('test.group')::uuid);
  perform pg_temp.check(jsonb_array_length(r->'members') = 2 and (r->>'is_owner')::boolean, 'detalhe com 2 membros');
  perform pg_temp.check(not (r::text like '%Segredo%'), 'grupo não expõe nomes de hábitos');
  perform pg_temp.check((r->'last_boss'->>'max_hp')::int = 6 and (r->'last_boss'->>'damage')::int = 7,
    'chefe da semana passada: vida 80% de 7 missões, dano 7');
  r := public.claim_group_boss(current_setting('test.group')::uuid, v_last);
  perform pg_temp.check((r->>'claimed')::boolean and (r->>'coins_awarded')::int = 30, 'chefe do grupo rende 30 a cada membro');
  r := public.claim_group_boss(current_setting('test.group')::uuid, v_last);
  perform pg_temp.check(not (r->>'claimed')::boolean, 'chefe do grupo paga uma vez por membro');
  perform pg_temp.check(jsonb_array_length(public.my_groups()) = 1, 'grupo aparece na lista');
end $$;

-- completa 6 membros; o 7º não entra
reset role;
insert into public.group_members (group_id, user_id)
select current_setting('test.group')::uuid, u
from unnest(array['aaaaaaaa-1111-1111-1111-111111111111', 'bbbbbbbb-1111-1111-1111-111111111111',
                  '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999']::uuid[]) u;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.groups) = 0 and (select count(*) from public.friendships) = 0,
    'B não vê grupos nem amizades dos outros');
  begin
    perform public.group_detail(current_setting('test.group')::uuid);
    raise exception 'FALHOU: B viu grupo de fora';
  exception when no_data_found then null;
  end;
  begin
    perform public.claim_group_boss(current_setting('test.group')::uuid, date_trunc('week', pg_temp.today())::date - 7);
    raise exception 'FALHOU: B resgatou chefe de grupo alheio';
  exception when no_data_found then null;
  end;
  begin
    perform public.join_group(current_setting('test.group_code'));
    raise exception 'FALHOU: entrou no grupo cheio';
  exception when sqlstate 'PR044' then null;
  end;
end $$;

-- a dona sai: o membro mais antigo assume
select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
do $$ begin
  perform public.leave_group(current_setting('test.group')::uuid);
  perform pg_temp.check(jsonb_array_length(public.my_groups()) = 0, 'Lia saiu do grupo');
end $$;
reset role;
do $$ begin
  perform pg_temp.check(
    (select owner from public.groups where id = current_setting('test.group')::uuid) = 'dddddddd-1111-1111-1111-111111111111',
    'Mel vira dona do grupo');
end $$;

-- ── Diário de humor ─────────────────────────────────────────
-- começa desligado pela feature flag: nada é gravado
select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$ begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_mood_journal') = 0,
    'diário começa desligado');
  begin
    perform public.save_mood_entry(pg_temp.today(), 4);
    raise exception 'FALHOU: gravou com o diário desligado';
  exception when sqlstate 'PR050' then null;
  end;
  begin
    update public.app_settings set value = 1 where key = 'feature_mood_journal';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_mood_journal') = 0,
    'o app não liga a flag sozinho');
end $$;
update public.app_settings set value = 1 where key = 'feature_mood_journal';
set local role authenticated;
do $$
declare
  r jsonb;
  coins0 integer := (select coalesce(sum(amount), 0) from public.coin_transactions);
begin
  begin
    insert into public.mood_entries (user_id, local_date, mood)
    values ('cccccccc-1111-1111-1111-111111111111', pg_temp.today(), 4);
    raise exception 'FALHOU: app gravou humor direto';
  exception when insufficient_privilege then null;
  end;

  r := public.save_mood_entry(pg_temp.today(), 4, array['grato', 'motivado', 'grato'], '  Dia bom  ');
  perform pg_temp.check((r->>'coins_awarded')::int = 3, 'primeiro check-in do dia rende 3 Cristais');
  perform pg_temp.check(
    (select tags = array['grato', 'motivado'] and note = 'Dia bom' from public.mood_entries
     where local_date = pg_temp.today()), 'sentimentos sem repetição e nota limpa');

  r := public.save_mood_entry(pg_temp.today(), 2, '{}', null);
  perform pg_temp.check((r->>'coins_awarded')::int = 0, 'editar o dia não paga de novo');
  perform pg_temp.check((select mood from public.mood_entries where local_date = pg_temp.today()) = 2, 'humor atualizado');
  perform pg_temp.check((select coalesce(sum(amount), 0) from public.coin_transactions) = coins0 + 3, 'só 3 Cristais no total');

  perform public.save_mood_entry(pg_temp.today() - 1, 5);
  begin
    perform public.save_mood_entry(pg_temp.today() - 2, 3);
    raise exception 'FALHOU: humor fora da janela';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_mood_entry(pg_temp.today(), 6);
    raise exception 'FALHOU: humor 6';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_mood_entry(pg_temp.today(), 3, array['feliz']);
    raise exception 'FALHOU: sentimento fora da lista';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_mood_entry(pg_temp.today(), 3, '{}', repeat('a', 501));
    raise exception 'FALHOU: nota longa';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- amiga (Mel) não vê o humor de Lia
select set_config('request.jwt.claim.sub', 'dddddddd-1111-1111-1111-111111111111', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.mood_entries) = 0, 'humor é privado, nem amigos veem');
end $$;

-- ── Feature flags dos recursos antigos ──────────────────────
reset role;
do $$ begin
  perform pg_temp.check(
    (select count(*) from public.app_settings where key like 'feature\_%' and value = 1) >= 9,
    'flags dos recursos antigos nascem ligadas');
  perform pg_temp.check(not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like '%\_\_impl'
        and has_function_privilege('authenticated', p.oid, 'execute')),
    'o app não chama as funções __impl direto (só pelos porteiros)');
end $$;
update public.app_settings set value = 0
where key in ('feature_shop', 'feature_challenges', 'feature_social', 'feature_flash_mission', 'feature_streak_shields');

select set_config('request.jwt.claim.sub', 'cccccccc-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$ begin
  begin
    perform public.buy_cosmetic('aura_fogo');
    raise exception 'FALHOU: Loja desligada vendeu';
  exception when sqlstate 'PR050' then null;
  end;
  begin
    perform public.start_journey('bbbbbbbb-2222-2222-2222-222222222223', 21);
    raise exception 'FALHOU: Desafios desligados';
  exception when sqlstate 'PR050' then null;
  end;
  begin
    perform public.search_users('Juca');
    raise exception 'FALHOU: Social desligado';
  exception when sqlstate 'PR050' then null;
  end;
  begin
    perform public.my_flash_mission();
    raise exception 'FALHOU: Missão relâmpago desligada';
  exception when sqlstate 'PR050' then null;
  end;
  begin
    perform public.buy_streak_shield();
    raise exception 'FALHOU: Escudos desligados';
  exception when sqlstate 'PR050' then null;
  end;
  -- ler continua liberado
  perform public.my_friends();
  perform public.my_groups();
end $$;

-- linha ausente = ligada (só para recursos antigos)
reset role;
delete from public.app_settings where key = 'feature_social';
set local role authenticated;
do $$ begin
  perform public.search_users('Juca');
end $$;

-- Oráculo desligado: a Edge Function recebe o motivo do bloqueio
reset role;
update public.app_settings set value = 0 where key = 'feature_oracle';
set local role service_role;
do $$ begin
  perform pg_temp.check(
    public.ai_plan_block_reason('cccccccc-1111-1111-1111-111111111111', 'plan') like '%Oráculo está desativado%',
    'Oráculo desligado bloqueia novos planos');
end $$;
reset role;
update public.app_settings set value = 1 where key in ('feature_shop', 'feature_challenges', 'feature_flash_mission', 'feature_streak_shields', 'feature_oracle', 'feature_habit_kinds', 'feature_habit_stats', 'feature_smart_notifications');
insert into public.app_settings (key, value) values ('feature_social', 1) on conflict (key) do update set value = 1;
set local role service_role;
do $$ begin
  perform pg_temp.check(
    coalesce(public.ai_plan_block_reason('cccccccc-1111-1111-1111-111111111111', 'plan'), '') not like '%desativado%',
    'Oráculo ligado volta ao limite normal');
end $$;
reset role;

-- ── Exportação de dados (LGPD) ──────────────────────────────
reset role;
update public.app_settings set value = 0 where key = 'feature_data_export';
select set_config('request.jwt.claim.sub', 'dddddddd-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$ begin
  begin
    perform public.export_my_data();
    raise exception 'FALHOU: exportou com a flag desligada';
  exception when sqlstate 'PR050' then null;
  end;
end $$;
reset role;
update public.app_settings set value = 1 where key = 'feature_data_export';
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.export_my_data();
  perform pg_temp.check(r->'conta'->>'email' = 'mel@teste.dev', 'exporta o e-mail da conta');
  perform pg_temp.check(r->'perfil'->>'display_name' = 'Mel', 'exporta o perfil');
  perform pg_temp.check(jsonb_array_length(r->'habits') = 1 and r->'habits'->0->>'title' = 'Segredo da Mel',
    'exporta os próprios hábitos');
  perform pg_temp.check(jsonb_array_length(r->'habit_logs') >= 20, 'exporta os registros');
  perform pg_temp.check(not (r->'habits'->0 ? 'user_id'), 'sem user_id repetido em cada linha');
  perform pg_temp.check(jsonb_array_length(r->'friendships') = 1, 'exporta o vínculo com a amiga');
  perform pg_temp.check(not (r::text like '%lia@teste.dev%') and not (r::text like '%"Lia"%'),
    'nada dos dados pessoais da amiga');
  perform pg_temp.check(jsonb_array_length(r->'groups') = 1 and (r->'groups'->0->>'sou_dono')::boolean,
    'exporta o grupo (Mel virou dona)');
end $$;
reset role;
update public.app_settings set value = 0 where key = 'feature_data_export';

-- ── App em inglês ───────────────────────────────────────────
reset role;
do $$ begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_english') = 0,
    'inglês começa desligado');
end $$;

-- ── Modo férias ─────────────────────────────────────────────
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-1111-1111-1111-111111111111', 'vera@teste.dev', '{"timezone":"America/Manaus"}'),
  ('eeeeeeee-2222-2222-2222-222222222222', 'rui@teste.dev', '{"timezone":"America/Manaus"}');
insert into public.habits (id, user_id, title, difficulty, start_date) values
  ('eeeeeeee-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'eeeeeeee-1111-1111-1111-111111111111', 'Caminhar', 'easy',
   pg_temp.today() - 20);

-- começa desligado: as duas funções recusam com PR050
select set_config('request.jwt.claim.sub', 'eeeeeeee-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$ begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_vacation') = 0,
    'férias começam desligadas');
  begin
    perform public.start_vacation(pg_temp.today(), 3);
    raise exception 'FALHOU: marcou férias com a flag desligada';
  exception when sqlstate 'PR050' then null;
  end;
  begin
    perform public.end_vacation(gen_random_uuid());
    raise exception 'FALHOU: encerrou férias com a flag desligada';
  exception when sqlstate 'PR050' then null;
  end;
end $$;
reset role;
update public.app_settings set value = 1 where key = 'feature_vacation';

-- regras de start_vacation
set local role authenticated;
do $$
declare
  r jsonb;
  s date;
  y integer;
begin
  begin
    insert into public.vacations (user_id, start_date, end_date)
    values ('eeeeeeee-1111-1111-1111-111111111111', pg_temp.today() - 5, pg_temp.today());
    raise exception 'FALHOU: app gravou férias direto';
  exception when insufficient_privilege then null;
  end;

  r := public.start_vacation(pg_temp.today(), 3);
  perform pg_temp.check((r->>'end_date')::date = pg_temp.today() + 2, 'férias de 3 dias terminam 2 dias depois');
  begin
    perform public.start_vacation(pg_temp.today() + 2, 2);
    raise exception 'FALHOU: férias sobrepostas';
  exception when sqlstate 'PR062' then null;
  end;
  begin
    perform public.start_vacation(pg_temp.today() - 1, 2);
    raise exception 'FALHOU: férias no passado';
  exception when sqlstate 'PR060' then null;
  end;
  begin
    perform public.start_vacation(pg_temp.today() + 61, 2);
    raise exception 'FALHOU: férias longe demais';
  exception when sqlstate 'PR060' then null;
  end;
  begin
    perform public.start_vacation(pg_temp.today() + 10, 15);
    raise exception 'FALHOU: férias de 15 dias';
  exception when sqlstate 'PR061' then null;
  end;
  begin
    perform public.start_vacation(pg_temp.today() + 10, 0);
    raise exception 'FALHOU: férias de 0 dias';
  exception when sqlstate 'PR061' then null;
  end;

  -- encerrar: férias que começam hoje são apagadas
  perform public.end_vacation((r->>'id')::uuid);
  perform pg_temp.check(not exists (select 1 from public.vacations), 'férias de hoje encerradas são apagadas');
  begin
    perform public.end_vacation((r->>'id')::uuid);
    raise exception 'FALHOU: encerrou férias inexistentes';
  exception when sqlstate 'P0002' then null;
  end;
end $$;

-- em andamento: encerrar termina ontem
reset role;
insert into public.vacations (id, user_id, start_date, end_date) values
  ('eeeeeeee-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eeeeeeee-1111-1111-1111-111111111111',
   pg_temp.today() - 2, pg_temp.today() + 2);
set local role authenticated;
do $$ begin
  perform public.end_vacation('eeeeeeee-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  perform pg_temp.check(
    (select end_date from public.vacations where id = 'eeeeeeee-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = pg_temp.today() - 1,
    'férias em andamento terminam ontem');
end $$;

-- limite de 30 dias no ano: 28 já usados no ano de S, longe de S
reset role;
delete from public.vacations where user_id = 'eeeeeeee-1111-1111-1111-111111111111';
do $$
declare
  s date := pg_temp.today() + 40;
  y integer;
  b date;
begin
  if extract(year from s) <> extract(year from s + 2) then s := s + 3; end if;
  y := extract(year from s)::integer;
  -- bloco de 28 dias no começo ou no fim do ano, o que não encostar em [hoje, S]
  b := make_date(y, 1, 1);
  if b + 27 >= pg_temp.today() - 1 and b <= s + 3 then b := make_date(y, 12, 1); end if;
  insert into public.vacations (user_id, start_date, end_date) values
    ('eeeeeeee-1111-1111-1111-111111111111', b, b + 13),
    ('eeeeeeee-1111-1111-1111-111111111111', b + 14, b + 27);
  perform set_config('test.vac_start', s::text, true);
end $$;
set local role authenticated;
do $$
declare
  s date := current_setting('test.vac_start')::date;
begin
  begin
    perform public.start_vacation(s, 3);
    raise exception 'FALHOU: passou de 30 dias no ano';
  exception when sqlstate 'PR063' then null;
  end;
  perform pg_temp.check(
    (select count(*) from public.vacations where start_date = s) = 0, 'férias recusadas não ficam gravadas');
  perform public.start_vacation(s, 2);
  perform pg_temp.check(
    (select count(*) from public.vacations where start_date = s) = 1, 'até 30 dias no ano é aceito');
end $$;

-- férias valem no streak do banco e no chefe da semana
reset role;
delete from public.vacations where user_id = 'eeeeeeee-1111-1111-1111-111111111111';
insert into public.habit_logs (user_id, habit_id, local_date)
select 'eeeeeeee-1111-1111-1111-111111111111', 'eeeeeeee-aaaa-aaaa-aaaa-aaaaaaaaaaaa', d::date
from unnest(array[pg_temp.today() - 7, pg_temp.today() - 6, pg_temp.today() - 5, pg_temp.today()]) d;
do $$
declare
  monday date := date_trunc('week', pg_temp.today())::date;
  hp_before integer;
begin
  perform pg_temp.check(public.user_streak('eeeeeeee-1111-1111-1111-111111111111') < 4,
    'sem férias, três faltas seguidas quebram o streak');
  select max_hp into hp_before from public.weekly_boss_status('eeeeeeee-1111-1111-1111-111111111111', monday);
  perform pg_temp.check(hp_before > 0, 'chefe tem vida sem férias');

  insert into public.vacations (user_id, start_date, end_date) values
    ('eeeeeeee-1111-1111-1111-111111111111', pg_temp.today() - 4, pg_temp.today() - 1);
  perform pg_temp.check(public.user_streak('eeeeeeee-1111-1111-1111-111111111111') = 4,
    'dias de férias não contam nem quebram o streak');

  delete from public.vacations where user_id = 'eeeeeeee-1111-1111-1111-111111111111';
  insert into public.vacations (user_id, start_date, end_date) values
    ('eeeeeeee-1111-1111-1111-111111111111', monday, monday + 6);
  perform pg_temp.check(
    (select max_hp from public.weekly_boss_status('eeeeeeee-1111-1111-1111-111111111111', monday)) = 0,
    'semana inteira de férias: o chefe não aparece');
end $$;

-- férias são privadas
select set_config('request.jwt.claim.sub', 'eeeeeeee-2222-2222-2222-222222222222', true);
set local role authenticated;
do $$ begin
  perform pg_temp.check((select count(*) from public.vacations) = 0, 'férias de outra pessoa não aparecem');
end $$;
reset role;

-- ── Pedido de feedback (pop-up com nota) ───────────────────
-- Vera (eeee…1111) já tem 4 registros (testes do modo férias): hoje − 7, − 6, − 5 e hoje.
reset role;
select set_config('request.jwt.claim.sub', 'eeeeeeee-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
declare
  u jsonb;
begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_feedback_prompt') = 0,
    'pedido de feedback começa desligado');
  perform pg_temp.check((select value from public.app_settings where key = 'feedback_prompt_min_missions') = 15,
    'regras do pedido em app_settings');
  begin
    perform public.submit_feedback_rating(5);
    raise exception 'FALHOU: nota com a flag desligada';
  exception when sqlstate 'PR050' then null;
  end;

  u := public.my_feedback_prompt_usage();
  perform pg_temp.check((u->>'first_log_date')::date = pg_temp.today() - 7, 'uso: primeiro registro');
  perform pg_temp.check((u->>'missions_done')::int = 4, 'uso: total de missões');
  perform pg_temp.check(not (u->>'already_rated')::boolean, 'uso: ainda sem nota');

  -- o formulário continua gravando direto; nota pelo insert direto, não
  insert into public.feedback (kind, message, platform) values ('ideia', 'Mais chefes, por favor', 'ios');
  begin
    insert into public.feedback (kind, message, rating, source) values ('elogio', null, 5, 'prompt');
    raise exception 'FALHOU: nota gravada direto na tabela';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feedback (kind, message) values ('outro', null);
    raise exception 'FALHOU: formulário sem mensagem';
  exception when check_violation then null;
  end;
end $$;
reset role;
update public.app_settings set value = 1 where key = 'feature_feedback_prompt';
set local role authenticated;
do $$
declare
  v_id uuid;
begin
  v_id := public.submit_feedback_rating(5, null, '1.0.0', 'ios');
  perform pg_temp.check(
    (select kind = 'elogio' and source = 'prompt' and rating = 5 and message is null
     from public.feedback where id = v_id), 'nota 5 vira elogio, sem comentário');
  v_id := public.submit_feedback_rating(2, '  Muitas notificações  ');
  perform pg_temp.check(
    (select kind = 'outro' and message = 'Muitas notificações' from public.feedback where id = v_id),
    'nota baixa com o porquê, comentário limpo');
  perform pg_temp.check((public.my_feedback_prompt_usage()->>'already_rated')::boolean, 'uso: já deu nota');
  begin
    perform public.submit_feedback_rating(0);
    raise exception 'FALHOU: nota 0';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.submit_feedback_rating(4, repeat('a', 1001));
    raise exception 'FALHOU: comentário longo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.submit_feedback_rating(4, null, null, 'windows');
    raise exception 'FALHOU: plataforma inválida';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- ── Resumo da semana ────────────────────────────────────────
reset role;
do $$ begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_weekly_recap') = 0,
    'resumo da semana começa desligado');
end $$;

-- ── Patentes dos chefes ─────────────────────────────────────
-- Vera (eeee…1111): um hábito diário desde hoje − 20; sem férias para não zerar a semana.
reset role;
delete from public.vacations where user_id = 'eeeeeeee-1111-1111-1111-111111111111';
do $$
declare
  monday date := date_trunc('week', pg_temp.today())::date;
  boss text := public.boss_for_week(date_trunc('week', pg_temp.today())::date);
begin
  perform pg_temp.check((select value from public.app_settings where key = 'feature_boss_ranks') = 0,
    'patentes começam desligadas');
  perform pg_temp.check((select value from public.app_settings where key = 'feature_bestiary') = 0,
    'bestiário começa desligado');
  perform pg_temp.check(public.boss_for_week(monday) = public.boss_for_week(monday - 42),
    'o rodízio repete a cada 6 semanas');
  perform pg_temp.check(public.boss_for_week(monday) <> public.boss_for_week(monday - 7),
    'semanas seguidas, chefes diferentes');
  -- três vitórias antigas contra o mesmo chefe: o desta semana seria Lorde
  insert into public.boss_victories (user_id, week_start, boss_id, rank) values
    ('eeeeeeee-1111-1111-1111-111111111111', monday - 42, boss, 0),
    ('eeeeeeee-1111-1111-1111-111111111111', monday - 84, boss, 0),
    ('eeeeeeee-1111-1111-1111-111111111111', monday - 126, boss, 0);
  perform pg_temp.check(public.boss_rank('eeeeeeee-1111-1111-1111-111111111111', monday) = 0,
    'flag desligada: todo chefe é Soldado');
  perform pg_temp.check(
    (select max_hp from public.weekly_boss_status('eeeeeeee-1111-1111-1111-111111111111', monday)) = 6,
    'Soldado: 80% de 7 missões = 6');
end $$;
update public.app_settings set value = 1 where key = 'feature_boss_ranks';
do $$
declare
  monday date := date_trunc('week', pg_temp.today())::date;
begin
  perform pg_temp.check(public.boss_rank('eeeeeeee-1111-1111-1111-111111111111', monday) = 3,
    'três vitórias: Lorde');
  perform pg_temp.check(
    (select max_hp from public.weekly_boss_status('eeeeeeee-1111-1111-1111-111111111111', monday)) = 7,
    'Lorde: 95% de 7 missões = 7');
  -- semana inteira feita
  insert into public.habit_logs (user_id, habit_id, local_date)
  select 'eeeeeeee-1111-1111-1111-111111111111', 'eeeeeeee-aaaa-aaaa-aaaa-aaaaaaaaaaaa', d::date
  from generate_series(monday, monday + 6, interval '1 day') d
  on conflict do nothing;
end $$;

select set_config('request.jwt.claim.sub', 'eeeeeeee-1111-1111-1111-111111111111', true);
set local role authenticated;
do $$
declare
  monday date := date_trunc('week', pg_temp.today())::date;
  r jsonb;
begin
  begin
    insert into public.boss_victories (user_id, week_start, boss_id, rank)
    values ('eeeeeeee-1111-1111-1111-111111111111', monday - 7, 'golem', 3);
    raise exception 'FALHOU: app gravou vitória direto';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.check((select count(*) from public.boss_ranks) = 4, 'tabela de patentes legível');
  r := public.claim_weekly_boss(monday);
  perform pg_temp.check((r->>'coins_awarded')::int = 130 and (r->>'rank')::int = 3,
    'Lorde derrotado rende 130 Cristais');
  perform pg_temp.check(
    (select rank from public.boss_victories where week_start = monday) = 3, 'vitória gravada com a patente');
  r := public.claim_weekly_boss(monday);
  perform pg_temp.check((r->>'coins_awarded')::int = 0, 'resgate não paga duas vezes');
  perform pg_temp.check((select count(*) from public.boss_victories where week_start = monday) = 1,
    'nem grava a vitória duas vezes');
end $$;

-- vitórias são privadas
select set_config('request.jwt.claim.sub', 'eeeeeeee-2222-2222-2222-222222222222', true);
do $$ begin
  perform pg_temp.check((select count(*) from public.boss_victories) = 0, 'vitórias de outra pessoa não aparecem');
end $$;
reset role;
update public.app_settings set value = 0 where key = 'feature_boss_ranks';

-- Excluir a conta apaga tudo em cascata, mesmo hábitos com registros
reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform pg_temp.check(
    not exists (select 1 from public.habits where user_id = '11111111-1111-1111-1111-111111111111'),
    'exclusão da conta remove os hábitos');
end $$;

rollback;

select 'ALL TESTS PASSED' as result;
