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

-- Limite de pedidos à IA (consultado pela Edge Function com service role)
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
  perform pg_temp.check((select count(*) from public.xp_rules) = 4, 'regras de XP são públicas');

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
  foreach t in array array['profiles', 'objectives', 'habits', 'habit_logs', 'xp_rules', 'xp_transactions', 'ai_plans'] loop
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
