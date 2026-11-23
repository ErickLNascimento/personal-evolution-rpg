-- IA: limites de uso e decisão sobre os planos propostos.
-- A Edge Function ai-plan grava o plano (service role); o app só decide por decide_ai_plan.
-- A IA nunca cria hábito nem XP: hábitos nascem só quando o usuário aceita, e XP só por log_habit.
--
-- Formato do payload (prompt_version plan-v1):
--   { "summary": text,
--     "habits": [ { "title", "difficulty", "schedule_days", "objective_title" | null,
--                   "objective_category", "rationale" } ] }

-- ─────────────────────────────────────────────────────────────
-- Limite de pedidos (chamado pela Edge Function antes de gastar com a IA)
--   initial: até 3 por dia local; weekly: até 2 por semana local (segunda a domingo)
-- Devolve null se pode, ou o motivo em português.
-- ─────────────────────────────────────────────────────────────
create or replace function public.ai_plan_block_reason(p_user_id uuid, p_kind text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_from timestamptz;
  v_count integer;
begin
  select timezone into v_tz from public.profiles where id = p_user_id;
  if v_tz is null then
    return 'Perfil não encontrado.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and ai_consent_at is not null) then
    return 'Ative a permissão da IA no Perfil.';
  end if;

  v_today := (now() at time zone v_tz)::date;
  if p_kind = 'initial' then
    v_from := v_today::timestamp at time zone v_tz;
    select count(*) into v_count from public.ai_plans
    where user_id = p_user_id and kind = 'initial' and created_at >= v_from;
    if v_count >= 3 then return 'Você já pediu 3 planos hoje. Tente de novo amanhã.'; end if;
  elsif p_kind = 'weekly' then
    v_from := date_trunc('week', v_today)::timestamp at time zone v_tz;
    select count(*) into v_count from public.ai_plans
    where user_id = p_user_id and kind = 'weekly' and created_at >= v_from;
    if v_count >= 2 then return 'Você já pediu 2 revisões nesta semana. Tente de novo na segunda.'; end if;
  else
    return 'Tipo de plano inválido.';
  end if;
  return null;
end;
$$;

revoke execute on function public.ai_plan_block_reason(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_plan_block_reason(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- decide_ai_plan: aceita (criando os hábitos escolhidos) ou recusa um plano proposto.
-- p_items: posições (0, 1, …) dos hábitos de payload.habits que o usuário escolheu.
-- Tudo numa transação: se um hábito for inválido, nada é criado.
-- ─────────────────────────────────────────────────────────────
create or replace function public.decide_ai_plan(p_plan_id uuid, p_accept boolean, p_items integer[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.ai_plans%rowtype;
  v_today date;
  v_item jsonb;
  v_idx integer;
  v_objective uuid;
  v_title text;
  v_category text;
  v_created integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_plan from public.ai_plans where id = p_plan_id and user_id = v_user for update;
  if not found then
    raise exception 'Plano não encontrado' using errcode = 'P0002';
  end if;
  if v_plan.status <> 'proposed' then
    raise exception 'Este plano já foi decidido' using errcode = '22023';
  end if;

  if p_accept then
    v_today := public.user_today(v_user);
    foreach v_idx in array (select coalesce(array_agg(distinct i order by i), '{}') from unnest(p_items) i) loop
      v_item := v_plan.payload -> 'habits' -> v_idx;
      if v_item is null or v_idx < 0 then
        raise exception 'Sugestão % não existe neste plano', v_idx using errcode = '22023';
      end if;

      -- Objetivo sugerido: reusa um ativo com o mesmo nome, ou cria.
      v_objective := null;
      v_title := nullif(btrim(v_item ->> 'objective_title'), '');
      v_category := v_item ->> 'objective_category';
      if v_title is not null then
        select id into v_objective from public.objectives
        where user_id = v_user and status = 'active' and lower(title) = lower(v_title)
        limit 1;
        if v_objective is null then
          insert into public.objectives (user_id, title, category)
          values (v_user, left(v_title, 120), v_category)
          returning id into v_objective;
        end if;
      end if;

      -- Os check das tabelas validam título, dificuldade e agenda.
      insert into public.habits (user_id, objective_id, title, difficulty, schedule_days, start_date)
      values (
        v_user,
        v_objective,
        btrim(v_item ->> 'title'),
        (v_item ->> 'difficulty')::public.difficulty,
        array(select distinct jsonb_array_elements_text(v_item -> 'schedule_days')::smallint order by 1),
        v_today
      );
      v_created := v_created + 1;
    end loop;
  end if;

  update public.ai_plans
  set status = case when p_accept then 'accepted' else 'rejected' end, decided_at = now()
  where id = p_plan_id;

  return jsonb_build_object('status', case when p_accept then 'accepted' else 'rejected' end, 'habits_created', v_created);
end;
$$;

revoke execute on function public.decide_ai_plan(uuid, boolean, integer[]) from public, anon;
grant execute on function public.decide_ai_plan(uuid, boolean, integer[]) to authenticated;

-- A decisão passa a ser só pela função (que valida e cria os hábitos junto).
revoke update on public.ai_plans from authenticated;
revoke update (status, decided_at) on public.ai_plans from authenticated;
