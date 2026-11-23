-- Plano da IA mais flexível:
--   1) a pessoa ajusta nome, dificuldade e dias de uma sugestão antes de aceitar;
--   2) "Trocar esta": a Edge Function substitui UMA sugestão do plano (até 3 trocas por plano).

alter table public.ai_plans add column swaps smallint not null default 0 check (swaps between 0 and 3);

-- A Edge Function (service_role) troca a sugestão no plano proposto; o app continua sem poder alterar planos.
grant update (payload, swaps) on public.ai_plans to service_role;

-- ─────────────────────────────────────────────────────────────
-- decide_ai_plan: igual ao anterior, agora aceitando ajustes por sugestão.
-- p_edits: [{ "index", "title", "difficulty", "schedule_days" }] — só vale para os índices escolhidos.
-- Os check das tabelas continuam validando tudo (título, dificuldade, agenda).
-- ─────────────────────────────────────────────────────────────
drop function public.decide_ai_plan(uuid, boolean, integer[]);

create function public.decide_ai_plan(
  p_plan_id uuid,
  p_accept boolean,
  p_items integer[] default '{}',
  p_edits jsonb default '[]'::jsonb
)
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
  v_edit jsonb;
  v_idx integer;
  v_objective uuid;
  v_title text;
  v_category text;
  v_created integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_edits) <> 'array' then
    raise exception 'Ajustes inválidos' using errcode = '22023';
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

      -- Ajuste feito pela pessoa (se houver) substitui nome, dificuldade e dias.
      v_edit := null;
      select e into v_edit from jsonb_array_elements(p_edits) e where (e ->> 'index')::integer = v_idx limit 1;
      if v_edit is not null then
        v_item := v_item
          || jsonb_build_object('title', v_edit -> 'title')
          || jsonb_build_object('difficulty', v_edit -> 'difficulty')
          || jsonb_build_object('schedule_days', v_edit -> 'schedule_days');
      end if;

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

revoke execute on function public.decide_ai_plan(uuid, boolean, integer[], jsonb) from public, anon;
grant execute on function public.decide_ai_plan(uuid, boolean, integer[], jsonb) to authenticated;
