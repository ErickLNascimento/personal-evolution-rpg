-- Onboarding: áreas de foco válidas e conclusão do primeiro acesso numa transação.

-- Áreas de foco = categorias de objetivo, no máximo 3.
alter table public.profiles
  add constraint profiles_focus_areas_valid check (
    cardinality(focus_areas) <= 3
    and focus_areas <@ array[
      'health', 'career', 'finance', 'knowledge', 'productivity',
      'relationships', 'wellbeing', 'personal_growth'
    ]::text[]
  );

-- ─────────────────────────────────────────────────────────────
-- complete_onboarding: salva o perfil e cria os hábitos escolhidos de uma vez.
-- security invoker: tudo passa pelo RLS do próprio usuário.
-- p_habits: [{ title, difficulty, schedule_days, objective_title, objective_category }]
-- Objetivos com o mesmo nome (ativos) são reaproveitados.
-- ─────────────────────────────────────────────────────────────
create or replace function public.complete_onboarding(
  p_display_name text,
  p_focus_areas text[],
  p_difficulty public.difficulty,
  p_timezone text,
  p_habits jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_item jsonb;
  v_objective uuid;
  v_title text;
  v_created integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_habits) <> 'array' or jsonb_array_length(p_habits) > 10 then
    raise exception 'Envie no máximo 10 hábitos' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = v_user and onboarding_done) then
    -- Código próprio, para o app distinguir de fuso inválido (22023).
    raise exception 'Onboarding já concluído' using errcode = 'PR001';
  end if;

  -- O trigger valida o fuso; os check validam nome e áreas.
  update public.profiles
  set display_name = nullif(btrim(p_display_name), ''),
      focus_areas = coalesce(p_focus_areas, '{}'),
      difficulty = p_difficulty,
      timezone = p_timezone,
      onboarding_done = true
  where id = v_user;
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  v_today := (now() at time zone p_timezone)::date;

  for v_item in select * from jsonb_array_elements(p_habits) loop
    v_objective := null;
    v_title := nullif(btrim(v_item ->> 'objective_title'), '');
    if v_title is not null then
      select id into v_objective from public.objectives
      where user_id = v_user and status = 'active' and lower(title) = lower(v_title)
      limit 1;
      if v_objective is null then
        insert into public.objectives (title, category)
        values (v_title, v_item ->> 'objective_category')
        returning id into v_objective;
      end if;
    end if;

    insert into public.habits (objective_id, title, difficulty, schedule_days, start_date)
    values (
      v_objective,
      btrim(v_item ->> 'title'),
      (v_item ->> 'difficulty')::public.difficulty,
      array(select distinct jsonb_array_elements_text(v_item -> 'schedule_days')::smallint order by 1),
      v_today
    );
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('habits_created', v_created);
end;
$$;

revoke execute on function public.complete_onboarding(text, text[], public.difficulty, text, jsonb) from public, anon;
grant execute on function public.complete_onboarding(text, text[], public.difficulty, text, jsonb) to authenticated;
