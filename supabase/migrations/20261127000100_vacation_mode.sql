-- Modo férias (espelha packages/domain/src/vacation.ts).
--   · Períodos em public.vacations (início e fim inclusivos). Nesses dias nenhum hábito fica
--     agendado: habit_scheduled_on devolve false, então chefe da semana, jornadas, chefe do grupo
--     e o streak que os amigos veem ignoram o dia. O app esconde as missões; log_habit não muda.
--   · Regras (start_vacation): começa hoje ou depois (até 60 dias à frente), dura de 1 a 14 dias,
--     não cruza outro período e soma no máximo 30 dias por ano civil.
--   · end_vacation: apaga férias que ainda não começaram (ou começam hoje); em andamento,
--     terminam ontem e as missões voltam hoje.
--   · Feature flag: app_settings.feature_vacation (começa desligada). Desligada, o app esconde o
--     recurso e start_vacation/end_vacation recusam com PR050; férias já marcadas continuam
--     valendo (desligar não quebra o streak de quem está viajando). Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_vacation';
-- Erros: PR060 início no passado ou longe demais · PR061 duração · PR062 cruza outras férias ·
--        PR063 passa do limite do ano · P0002 férias não encontradas.

insert into public.app_settings (key, value) values ('feature_vacation', 0);

create table public.vacations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date < 14)
);
create index vacations_user_dates on public.vacations (user_id, start_date, end_date);

alter table public.vacations enable row level security;
create policy "vacations: ler o próprio" on public.vacations
  for select to authenticated using (user_id = auth.uid());
revoke all on public.vacations from anon, authenticated;
grant select on public.vacations to authenticated;

-- O usuário está de férias nesta data?
create or replace function public.on_vacation(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vacations v
    where v.user_id = p_user and p_date between v.start_date and v.end_date
  )
$$;
revoke execute on function public.on_vacation(uuid, date) from public, anon, authenticated;

-- O hábito vale nesta data? Agora também fora das férias (mesma regra de isHabitScheduledOn).
-- Deixa de ser immutable: lê a tabela de férias.
create or replace function public.habit_scheduled_on(p_habit public.habits, p_date date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_date >= p_habit.start_date
    and (p_habit.archived_on is null or p_date <= p_habit.archived_on)
    and extract(dow from p_date)::smallint = any (p_habit.schedule_days)
    and not public.on_vacation(p_habit.user_id, p_date)
$$;
revoke execute on function public.habit_scheduled_on(public.habits, date) from public, anon;

-- Dias de férias de um usuário que caem no ano civil p_year.
create or replace function public.vacation_days_in_year(p_user uuid, p_year integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(
    greatest(0, least(v.end_date, make_date(p_year, 12, 31))
                - greatest(v.start_date, make_date(p_year, 1, 1)) + 1)
  ), 0)::integer
  from public.vacations v
  where v.user_id = p_user
$$;
revoke execute on function public.vacation_days_in_year(uuid, integer) from public, anon, authenticated;

create or replace function public.start_vacation(p_start date, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_end date;
  v_row public.vacations;
  y integer;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_vacation');
  v_today := public.user_today(v_user);
  if p_start is null or p_start < v_today or p_start > v_today + 60 then
    raise exception 'As férias começam hoje ou em até 60 dias' using errcode = 'PR060';
  end if;
  if p_days is null or p_days < 1 or p_days > 14 then
    raise exception 'As férias duram de 1 a 14 dias' using errcode = 'PR061';
  end if;
  v_end := p_start + p_days - 1;

  -- Um pedido por vez para o mesmo usuário (evita duas marcações simultâneas passarem do limite).
  perform pg_advisory_xact_lock(hashtext('vacation:' || v_user));

  if exists (select 1 from public.vacations v
             where v.user_id = v_user and v.start_date <= v_end and p_start <= v.end_date) then
    raise exception 'Essas datas cruzam outras férias' using errcode = 'PR062';
  end if;

  insert into public.vacations (user_id, start_date, end_date)
  values (v_user, p_start, v_end)
  returning * into v_row;

  for y in select distinct extract(year from d)::integer from (values (p_start), (v_end)) as t(d) loop
    if public.vacation_days_in_year(v_user, y) > 30 then
      raise exception 'Passa de 30 dias de férias no ano' using errcode = 'PR063';
    end if;
  end loop;

  return jsonb_build_object('id', v_row.id, 'start_date', v_row.start_date, 'end_date', v_row.end_date);
end;
$$;

create or replace function public.end_vacation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_row public.vacations;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_vacation');
  v_today := public.user_today(v_user);
  select * into v_row from public.vacations where id = p_id and user_id = v_user for update;
  if not found or v_row.end_date < v_today then
    raise exception 'Férias não encontradas' using errcode = 'P0002';
  end if;
  if v_row.start_date >= v_today then
    delete from public.vacations where id = p_id;
    return jsonb_build_object('deleted', true);
  end if;
  update public.vacations set end_date = v_today - 1 where id = p_id returning * into v_row;
  return jsonb_build_object('deleted', false, 'end_date', v_row.end_date);
end;
$$;

revoke execute on function public.start_vacation(date, integer) from public, anon;
revoke execute on function public.end_vacation(uuid) from public, anon;
grant execute on function public.start_vacation(date, integer) to authenticated;
grant execute on function public.end_vacation(uuid) to authenticated;

-- Exportação dos dados (LGPD) passa a incluir as férias.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_out jsonb;
  v_rows jsonb;
  t text;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  perform public.require_feature('feature_data_export');

  v_out := jsonb_build_object(
    'formato', 'Personal Evolution RPG: exportação de dados pessoais (LGPD), versão 1',
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'id', v_user,
      'email', (select u.email from auth.users u where u.id = v_user)
    ),
    'perfil', (select to_jsonb(p) from public.profiles p where p.id = v_user)
  );

  -- Tabelas com user_id: todas as linhas do usuário, sem repetir o user_id em cada uma.
  foreach t in array array[
    'objectives', 'habits', 'habit_logs', 'habit_counts', 'xp_transactions', 'coin_transactions',
    'user_titles', 'user_unlocks', 'user_cosmetics', 'hero_history', 'flash_missions',
    'streak_shield_uses', 'custom_rewards', 'reward_redemptions', 'ai_plans', 'journeys',
    'mood_entries', 'feedback', 'group_members', 'vacations'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) - ''user_id''), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into v_rows using v_user;
    v_out := v_out || jsonb_build_object(t, v_rows);
  end loop;

  -- Vínculos sociais: só o id do outro e a situação (nada dos dados pessoais dele).
  v_out := v_out || jsonb_build_object(
    'friendships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'outro_usuario', case when f.requester = v_user then f.addressee else f.requester end,
        'enviado_por_mim', f.requester = v_user,
        'status', f.status,
        'criado_em', f.created_at,
        'aceito_em', f.accepted_at))
      from public.friendships f where v_user in (f.requester, f.addressee)), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.name, 'sou_dono', g.owner = v_user,
                                          'criado_em', g.created_at))
      from public.groups g join public.group_members m on m.group_id = g.id and m.user_id = v_user), '[]'::jsonb)
  );
  return v_out;
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
