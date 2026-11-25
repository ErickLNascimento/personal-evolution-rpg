-- Evolução do herói (docs/design/evolucao-do-heroi.md):
--   · raça (só visual), caminho, ramo e estágio no perfil;
--   · promoções por nível + missões na área do caminho;
--   · troca de caminho/ramo com espera de 14 dias;
--   · missão relâmpago: uma missão por dia com prazo e bônus;
--   · fim da loja de classes, com devolução dos Cristais gastos.
-- Caminho, ramo e estágio mudam SÓ por funções do banco (como XP e Cristais).
--
-- Novas chaves de idempotência:
--   flash:<log_id>            XP extra da missão relâmpago
--   coins:flash:<log_id>      Cristais da missão relâmpago
--   refund:<chave da compra>  devolução de uma classe comprada

-- ─────────────────────────────────────────────────────────────
-- Catálogos (nomes e textos ficam no domínio; aqui, identidade e regras)
-- ─────────────────────────────────────────────────────────────
create table public.path_catalog (
  id text primary key,
  areas text[] not null check (areas <@ array[
    'health', 'career', 'finance', 'knowledge', 'productivity',
    'relationships', 'wellbeing', 'personal_growth'
  ]::text[] and cardinality(areas) > 0)
);

insert into public.path_catalog (id, areas) values
  ('marcial', '{health}'),
  ('arcano', '{knowledge}'),
  ('destreza', '{productivity}'),
  ('espirito', '{wellbeing}'),
  ('natureza', '{personal_growth}'),
  ('cancao', '{relationships}'),
  ('oficio', '{career,finance}');

-- Requisitos e bônus de cada estágio (iguais para todos os caminhos).
-- area_pct: Cristais extras nas missões das áreas do caminho.
create table public.path_stage_rules (
  tier smallint primary key check (tier between 0 and 5),
  min_level integer not null check (min_level >= 1),
  min_missions integer not null check (min_missions >= 0),
  area_pct integer not null check (area_pct between 0 and 100)
);

insert into public.path_stage_rules (tier, min_level, min_missions, area_pct) values
  (0, 1, 0, 5),
  (1, 5, 10, 7),
  (2, 10, 40, 10),
  (3, 20, 120, 12),
  (4, 30, 300, 15),
  (5, 40, 500, 20);

-- Vantagens próprias (herdadas das classes antigas). branch nulo = vale para o caminho todo.
create table public.path_perks (
  path_id text not null references public.path_catalog (id),
  branch text check (branch in ('A', 'B')),
  min_tier smallint not null default 0,
  perfect_day_extra integer not null default 0,
  easy_extra integer not null default 0,
  yesterday_full boolean not null default false,
  night_extra integer not null default 0
);

insert into public.path_perks (path_id, branch, min_tier, perfect_day_extra, easy_extra, yesterday_full, night_extra) values
  ('cancao', null, 0, 5, 0, false, 0),     -- antigo Bardo
  ('natureza', null, 0, 0, 2, false, 0),   -- antigo Druida
  ('destreza', 'B', 3, 0, 0, true, 0),     -- antigo Ladino
  ('arcano', 'B', 3, 0, 0, false, 3);      -- antigo Necromante

alter table public.path_catalog enable row level security;
alter table public.path_stage_rules enable row level security;
alter table public.path_perks enable row level security;
create policy "path_catalog: leitura" on public.path_catalog for select to authenticated using (true);
create policy "path_stage_rules: leitura" on public.path_stage_rules for select to authenticated using (true);
create policy "path_perks: leitura" on public.path_perks for select to authenticated using (true);
revoke all on public.path_catalog, public.path_stage_rules, public.path_perks from anon, authenticated;
grant select on public.path_catalog, public.path_stage_rules, public.path_perks to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Estado do herói no perfil
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column race text not null default 'humano'
    check (race in ('humano', 'elfo', 'anao', 'orc', 'halfling', 'draconato')),
  add column path text references public.path_catalog (id),
  add column branch text check (branch in ('A', 'B')),
  add column stage smallint not null default 0 check (stage between 0 and 5),
  add column path_changed_at timestamptz,
  add constraint profiles_branch_from_stage_3 check (stage < 3 or branch is not null);

-- Histórico de promoções e trocas (linha do tempo do herói).
create table public.hero_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event text not null check (event in ('choose', 'promote', 'change')),
  path text not null references public.path_catalog (id),
  branch text,
  stage smallint not null,
  created_at timestamptz not null default now()
);
create index hero_history_user_idx on public.hero_history (user_id, created_at desc);
alter table public.hero_history enable row level security;
create policy "hero_history: ler o próprio" on public.hero_history
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.hero_history from anon, authenticated;
grant select on public.hero_history to authenticated;

-- O perfil é editável pelo próprio usuário (nome, raça, aparência…), mas caminho, ramo e
-- estágio só mudam pelas funções abaixo, que ligam o sinal per.hero_progress na transação.
create or replace function public.profiles_guard_hero_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('per.hero_progress', true), '') = 'on' then
    return new;
  end if;
  if new.path is distinct from old.path
     or new.branch is distinct from old.branch
     or new.stage is distinct from old.stage
     or new.path_changed_at is distinct from old.path_changed_at then
    raise exception 'Caminho e estágio só mudam por promoção ou troca de caminho' using errcode = 'PR010';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_hero_progress before update on public.profiles
  for each row execute function public.profiles_guard_hero_progress();

-- ─────────────────────────────────────────────────────────────
-- Auxiliares internas
-- ─────────────────────────────────────────────────────────────

-- Missões concluídas (registros ativos) nas áreas dadas. Hábito sem objetivo = Crescimento pessoal.
create or replace function public.area_missions(p_user_id uuid, p_areas text[])
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.habit_logs l
  join public.habits h on h.id = l.habit_id
  left join public.objectives o on o.id = h.objective_id
  where l.user_id = p_user_id and coalesce(o.category, 'personal_growth') = any (p_areas);
$$;

create or replace function public.user_level(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select public.level_from_xp(
    (select coalesce(sum(amount), 0)::integer from public.xp_transactions where user_id = p_user_id));
$$;

-- Maior estágio que nível e missões permitem.
create or replace function public.eligible_tier(p_level integer, p_missions integer)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(max(tier), 0)::smallint
  from public.path_stage_rules
  where min_level <= p_level and min_missions <= p_missions;
$$;

-- Espera entre trocas de caminho ou de ramo.
create or replace function public.path_change_cooldown()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '14 days' $$;

-- Bônus e vantagens do estágio atual do herói (usado por log_habit).
create or replace function public.hero_perks(p_user_id uuid)
returns table (
  areas text[],
  area_pct integer,
  perfect_day_extra integer,
  easy_extra integer,
  yesterday_full boolean,
  night_extra integer
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(c.areas, '{}'),
    coalesce(r.area_pct, 0),
    coalesce((select sum(k.perfect_day_extra) from public.path_perks k
              where k.path_id = p.path and (k.branch is null or k.branch = p.branch) and k.min_tier <= p.stage), 0)::integer,
    coalesce((select sum(k.easy_extra) from public.path_perks k
              where k.path_id = p.path and (k.branch is null or k.branch = p.branch) and k.min_tier <= p.stage), 0)::integer,
    coalesce((select bool_or(k.yesterday_full) from public.path_perks k
              where k.path_id = p.path and (k.branch is null or k.branch = p.branch) and k.min_tier <= p.stage), false),
    coalesce((select sum(k.night_extra) from public.path_perks k
              where k.path_id = p.path and (k.branch is null or k.branch = p.branch) and k.min_tier <= p.stage), 0)::integer
  from public.profiles p
  left join public.path_catalog c on c.id = p.path
  left join public.path_stage_rules r on r.tier = p.stage and p.path is not null
  where p.id = p_user_id;
$$;

-- ─────────────────────────────────────────────────────────────
-- my_hero_path: tudo o que o app precisa para a árvore e o card de promoção.
-- ─────────────────────────────────────────────────────────────
create or replace function public.my_hero_path()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_level integer;
  v_missions integer := 0;
  v_next public.path_stage_rules%rowtype;
  v_available timestamptz;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select * into v_p from public.profiles where id = v_user;
  v_level := public.user_level(v_user);
  if v_p.path is not null then
    v_missions := public.area_missions(v_user, (select areas from public.path_catalog where id = v_p.path));
  end if;
  select * into v_next from public.path_stage_rules where tier = v_p.stage + 1;
  if v_p.path_changed_at is not null then
    v_available := v_p.path_changed_at + public.path_change_cooldown();
  end if;
  return jsonb_build_object(
    'race', v_p.race,
    'path', v_p.path,
    'branch', v_p.branch,
    'stage', v_p.stage,
    'level', v_level,
    'area_missions', v_missions,
    'next_tier', case when v_next.tier is null then null else jsonb_build_object(
      'tier', v_next.tier, 'min_level', v_next.min_level, 'min_missions', v_next.min_missions) end,
    'can_promote', v_p.path is not null and v_next.tier is not null
      and v_level >= v_next.min_level and v_missions >= v_next.min_missions,
    'needs_branch', v_next.tier = 3 and v_p.branch is null,
    'change_available_at', case when v_available > now() then v_available end
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- choose_path: primeira escolha ou troca de caminho (e/ou de ramo).
-- O nível não muda; o estágio é recalculado pelas missões já feitas nas áreas do caminho.
-- Sem ramo, o estágio fica limitado a 2 (o ramo é escolhido na promoção para o 3).
-- Erros: P0002 caminho inexistente · 22023 ramo inválido · PR011 espera entre trocas
-- ─────────────────────────────────────────────────────────────
create or replace function public.choose_path(p_path text, p_branch text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_areas text[];
  v_branch text;
  v_stage smallint;
  v_first boolean;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  select areas into v_areas from public.path_catalog where id = p_path;
  if not found then
    raise exception 'Caminho não encontrado' using errcode = 'P0002';
  end if;
  if p_branch is not null and p_branch not in ('A', 'B') then
    raise exception 'Ramo inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':hero'));
  select * into v_p from public.profiles where id = v_user;
  v_first := v_p.path is null;

  -- mesmo caminho sem ramo novo: mantém o ramo atual
  v_branch := coalesce(p_branch, case when p_path = v_p.path then v_p.branch end);

  if not v_first and p_path = v_p.path and v_branch is not distinct from v_p.branch then
    return jsonb_build_object('path', v_p.path, 'branch', v_p.branch, 'stage', v_p.stage, 'changed', false);
  end if;
  if not v_first and v_p.path_changed_at is not null
     and v_p.path_changed_at + public.path_change_cooldown() > now() then
    raise exception 'Troca disponível em %', v_p.path_changed_at + public.path_change_cooldown()
      using errcode = 'PR011';
  end if;

  v_stage := public.eligible_tier(public.user_level(v_user), public.area_missions(v_user, v_areas));
  if v_branch is null then
    v_stage := least(v_stage, 2);
  end if;

  perform set_config('per.hero_progress', 'on', true);
  update public.profiles
  set path = p_path,
      branch = v_branch,
      stage = v_stage,
      path_changed_at = case when v_first then path_changed_at else now() end
  where id = v_user;
  perform set_config('per.hero_progress', 'off', true);

  insert into public.hero_history (user_id, event, path, branch, stage)
  values (v_user, case when v_first then 'choose' else 'change' end, p_path, v_branch, v_stage);

  return jsonb_build_object('path', p_path, 'branch', v_branch, 'stage', v_stage, 'changed', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- promote_hero: sobe um estágio, se nível e missões na área permitem.
-- Na promoção para o estágio 3 é preciso ter (ou escolher agora) o ramo A ou B.
-- Erros: PR016 sem caminho · PR013 estágio máximo · PR014 requisitos · PR015 falta o ramo
-- ─────────────────────────────────────────────────────────────
create or replace function public.promote_hero(p_branch text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_next public.path_stage_rules%rowtype;
  v_branch text;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_branch is not null and p_branch not in ('A', 'B') then
    raise exception 'Ramo inválido' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':hero'));
  select * into v_p from public.profiles where id = v_user;
  if v_p.path is null then
    raise exception 'Escolha um caminho primeiro' using errcode = 'PR016';
  end if;
  select * into v_next from public.path_stage_rules where tier = v_p.stage + 1;
  if not found then
    raise exception 'Estágio máximo alcançado' using errcode = 'PR013';
  end if;
  if public.user_level(v_user) < v_next.min_level
     or public.area_missions(v_user, (select areas from public.path_catalog where id = v_p.path)) < v_next.min_missions then
    raise exception 'Requisitos da promoção ainda não atendidos' using errcode = 'PR014';
  end if;

  v_branch := v_p.branch;
  if v_next.tier = 3 then
    v_branch := coalesce(p_branch, v_p.branch);
    if v_branch is null then
      raise exception 'Escolha o ramo A ou B' using errcode = 'PR015';
    end if;
  end if;

  perform set_config('per.hero_progress', 'on', true);
  update public.profiles set stage = v_next.tier, branch = v_branch where id = v_user;
  perform set_config('per.hero_progress', 'off', true);

  insert into public.hero_history (user_id, event, path, branch, stage)
  values (v_user, 'promote', v_p.path, v_branch, v_next.tier);

  return jsonb_build_object('path', v_p.path, 'branch', v_branch, 'stage', v_next.tier);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Missão relâmpago: uma missão do dia, sorteada na primeira consulta, com prazo de 4 horas.
-- Concluída hoje dentro do prazo: +50% do XP da missão e +10 Cristais (estornados ao desfazer).
-- ─────────────────────────────────────────────────────────────
create table public.flash_missions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  habit_id uuid not null references public.habits (id) on delete cascade,
  deadline timestamptz not null,
  primary key (user_id, local_date)
);
alter table public.flash_missions enable row level security;
create policy "flash_missions: ler o próprio" on public.flash_missions
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.flash_missions from anon, authenticated;
grant select on public.flash_missions to authenticated;

insert into public.xp_rules (key, amount) values ('flash_bonus_pct', 50);
insert into public.coin_rules (key, amount) values ('coin_flash', 10);

alter table public.xp_transactions drop constraint xp_transactions_source_type_check;
alter table public.xp_transactions add constraint xp_transactions_source_type_check
  check (source_type in ('habit', 'perfect_day', 'reversal', 'flash'));
alter table public.coin_transactions drop constraint coin_transactions_source_type_check;
alter table public.coin_transactions add constraint coin_transactions_source_type_check
  check (source_type in ('habit', 'perfect_day', 'level_up', 'purchase', 'reversal', 'achievement', 'flash', 'refund'));

-- Devolve a missão relâmpago de hoje (sorteando-a na primeira chamada do dia).
-- Só sorteia entre missões de hoje ainda não feitas; sem nenhuma, devolve null.
create or replace function public.my_flash_mission()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_tz text;
  v_row public.flash_missions%rowtype;
  v_habit uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  v_today := public.user_today(v_user);
  select timezone into v_tz from public.profiles where id = v_user;

  perform pg_advisory_xact_lock(hashtext(v_user::text || ':flash'));
  select * into v_row from public.flash_missions where user_id = v_user and local_date = v_today;
  if not found then
    select h.id into v_habit
    from public.habits h
    where h.user_id = v_user
      and h.start_date <= v_today
      and (h.archived_on is null or h.archived_on >= v_today)
      and extract(dow from v_today)::smallint = any (h.schedule_days)
      and not exists (select 1 from public.habit_logs l where l.habit_id = h.id and l.local_date = v_today)
    order by md5(v_user::text || v_today::text || h.id::text)
    limit 1;
    if v_habit is null then
      return null;
    end if;
    insert into public.flash_missions (user_id, local_date, habit_id, deadline)
    values (
      v_user, v_today, v_habit,
      -- 4 horas a partir de agora, sem passar da meia-noite local
      least(now() + interval '4 hours', ((v_today + 1)::timestamp at time zone v_tz) - interval '1 second')
    )
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'habit_id', v_row.habit_id,
    'local_date', v_row.local_date,
    'deadline', v_row.deadline,
    'done', exists (select 1 from public.habit_logs l where l.habit_id = v_row.habit_id and l.local_date = v_today),
    -- bônus de fato concedido (concluída dentro do prazo e não desfeita)
    'awarded', exists (
      select 1 from public.xp_transactions t
      join public.habit_logs l on l.id = t.source_id
      where t.source_type = 'flash' and l.habit_id = v_row.habit_id and l.local_date = v_today)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- grant_titles: igual ao anterior, mas devoluções da loja não contam como Cristais ganhos.
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_titles(p_user_id uuid, p_local_date date, p_perfect_now boolean)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_candidates text[] := '{}';
  v_granted text[];
  v_logs integer;
  v_previous date;
begin
  select timezone into v_tz from public.profiles where id = p_user_id;
  select count(*) into v_logs from public.habit_logs where user_id = p_user_id;

  if v_logs >= 1 then v_candidates := array_append(v_candidates, 'primeiro-passo'); end if;
  if v_logs >= 100 then v_candidates := array_append(v_candidates, 'centuriao'); end if;

  if (select count(*) from public.habit_logs l
      where l.user_id = p_user_id
        and (l.created_at at time zone v_tz)::date = l.local_date
        and extract(hour from l.created_at at time zone v_tz) < 8) >= 10 then
    v_candidates := array_append(v_candidates, 'mestre-das-manhas');
  end if;

  -- 1.000 Cristais ganhos no total (compras e devoluções não contam; estornos sim)
  if (select coalesce(sum(amount), 0) from public.coin_transactions
      where user_id = p_user_id and source_type not in ('purchase', 'refund')) >= 1000 then
    v_candidates := array_append(v_candidates, 'lorde-dos-cristais');
  end if;

  if (select count(*) from (
        select local_date from public.xp_transactions
        where user_id = p_user_id
          and (source_type = 'perfect_day' or (source_type = 'reversal' and idempotency_key like 'reversal:perfect-day:%'))
        group by local_date having sum(amount) > 0) d) >= 30 then
    v_candidates := array_append(v_candidates, 'inabalavel');
  end if;

  if p_perfect_now then
    select max(local_date) into v_previous from public.habit_logs
    where user_id = p_user_id and local_date < p_local_date;
    if v_previous is not null and v_previous <= p_local_date - 8 then
      v_candidates := array_append(v_candidates, 'fenix');
    end if;

    if (select count(distinct coalesce(o.category, 'personal_growth'))
        from public.habit_logs l
        join public.habits h on h.id = l.habit_id
        left join public.objectives o on o.id = h.objective_id
        where l.user_id = p_user_id and l.local_date = p_local_date) >= 4 then
      v_candidates := array_append(v_candidates, 'equilibrio-perfeito');
    end if;
  end if;

  with ins as (
    insert into public.user_titles (user_id, title_id)
    select p_user_id, t from unnest(v_candidates) t
    on conflict do nothing
    returning title_id
  )
  select coalesce(array_agg(title_id), '{}') into v_granted from ins;
  return v_granted;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- log_habit: XP igual ao anterior + missão relâmpago; Cristais pelo caminho e estágio
-- (no lugar da classe comprada). Reescrita completa.
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_habit(
  p_habit_id uuid,
  p_local_date date,
  p_qty numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_tz text;
  v_habit public.habits%rowtype;
  v_perks record;
  v_log_id uuid;
  v_xp integer := 0;
  v_flash_xp integer := 0;
  v_bonus integer := 0;
  v_occurrence integer;
  v_total_before integer;
  v_total_after integer;
  v_category text;
  v_coin integer := 0;
  v_coins_awarded integer := 0;
  v_amount integer;
  v_lvl integer;
  v_titles text[] := '{}';
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select * into v_habit from public.habits where id = p_habit_id and user_id = v_user;
  if not found then
    raise exception 'Hábito não encontrado' using errcode = 'P0002';
  end if;

  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível registrar hoje ou ontem' using errcode = '22023';
  end if;

  if p_local_date < v_habit.start_date
     or (v_habit.archived_on is not null and p_local_date > v_habit.archived_on)
     or not (extract(dow from p_local_date)::smallint = any (v_habit.schedule_days)) then
    raise exception 'Hábito não agendado para esta data' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  select coalesce(sum(amount), 0) into v_total_before from public.xp_transactions where user_id = v_user;

  insert into public.habit_logs (user_id, habit_id, local_date, qty)
  values (v_user, p_habit_id, p_local_date, p_qty)
  on conflict (habit_id, local_date) do nothing
  returning id into v_log_id;

  if v_log_id is not null then
    -- ── XP ──
    select amount into v_xp from public.xp_rules where key = 'habit_' || v_habit.difficulty::text;

    insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
    values (v_user, v_xp, 'habit', v_log_id, p_local_date, 'habit-log:' || v_log_id::text);

    -- ── Missão relâmpago: hoje, dentro do prazo ──
    if p_local_date = v_today and exists (
         select 1 from public.flash_missions f
         where f.user_id = v_user and f.local_date = v_today and f.habit_id = p_habit_id and now() <= f.deadline) then
      select ceil(v_xp * amount / 100.0)::integer into v_flash_xp from public.xp_rules where key = 'flash_bonus_pct';
      v_flash_xp := coalesce(v_flash_xp, 0);
      if v_flash_xp > 0 then
        insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
        values (v_user, v_flash_xp, 'flash', v_log_id, p_local_date, 'flash:' || v_log_id::text);
      end if;
      select amount into v_amount from public.coin_rules where key = 'coin_flash';
      if coalesce(v_amount, 0) > 0 then
        insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
        values (v_user, v_amount, 'flash', v_log_id, p_local_date, 'coins:flash:' || v_log_id::text);
        v_coins_awarded := v_coins_awarded + v_amount;
      end if;
    end if;

    if public.pending_scheduled_count(v_user, p_local_date) = 0
       and public.perfect_day_net(v_user, p_local_date) = 0 then
      select amount into v_bonus from public.xp_rules where key = 'perfect_day_bonus';
      if v_bonus > 0 then
        select count(*) + 1 into v_occurrence
        from public.xp_transactions
        where user_id = v_user and local_date = p_local_date and source_type = 'perfect_day';

        insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (
          v_user, v_bonus, 'perfect_day', p_local_date,
          'perfect-day:' || v_user::text || ':' || p_local_date::text || ':' || v_occurrence::text
        );
      end if;
    end if;

    -- ── Cristais da missão (caminho e estágio do herói) ──
    select * into v_perks from public.hero_perks(v_user);
    select timezone into v_tz from public.profiles where id = v_user;
    select o.category into v_category from public.objectives o where o.id = v_habit.objective_id;

    select amount into v_coin from public.coin_rules where key = 'coin_' || v_habit.difficulty::text;
    v_coin := coalesce(v_coin, 0);
    if p_local_date < v_today and not v_perks.yesterday_full then
      v_coin := ceil(v_coin / 2.0)::integer;
    end if;
    if coalesce(v_category, 'personal_growth') = any (v_perks.areas) then
      v_coin := v_coin + ceil(v_coin * v_perks.area_pct / 100.0)::integer;
    end if;
    if v_habit.difficulty = 'easy' then
      v_coin := v_coin + v_perks.easy_extra;
    end if;
    if v_perks.night_extra > 0 and p_local_date = v_today
       and extract(hour from now() at time zone v_tz) >= 20 then
      v_coin := v_coin + v_perks.night_extra;
    end if;

    if v_coin > 0 then
      insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
      values (v_user, v_coin, 'habit', v_log_id, p_local_date, 'coins:habit-log:' || v_log_id::text);
      v_coins_awarded := v_coins_awarded + v_coin;
    end if;

    -- ── Cristais do dia perfeito ──
    if v_bonus > 0 then
      select amount into v_amount from public.coin_rules where key = 'coin_perfect_day';
      v_amount := coalesce(v_amount, 0) + v_perks.perfect_day_extra;
      if v_amount > 0 then
        insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (
          v_user, v_amount, 'perfect_day', p_local_date,
          'coins:perfect-day:' || v_user::text || ':' || p_local_date::text || ':' || v_occurrence::text
        );
        v_coins_awarded := v_coins_awarded + v_amount;
      end if;
    end if;

    -- ── Cristais de subida de nível ──
    select coalesce(sum(amount), 0) into v_total_after from public.xp_transactions where user_id = v_user;
    select amount into v_amount from public.coin_rules where key = 'coin_level_up_per_level';
    for v_lvl in (public.level_from_xp(v_total_before) + 1)..public.level_from_xp(v_total_after) loop
      insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
      values (
        v_user, v_lvl * coalesce(v_amount, 0), 'level_up', p_local_date,
        'coins:level-up:' || v_user::text || ':' || v_lvl::text
      )
      on conflict (idempotency_key) do nothing;
      if found then
        v_coins_awarded := v_coins_awarded + v_lvl * coalesce(v_amount, 0);
      end if;
    end loop;

    -- ── Títulos ──
    v_titles := public.grant_titles(v_user, p_local_date, v_bonus > 0);
  end if;

  return jsonb_build_object(
    'logged', v_log_id is not null,
    'xp_awarded', v_xp,
    'flash_bonus', v_flash_xp,
    'perfect_day_bonus', v_bonus,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user),
    'coins_awarded', v_coins_awarded,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user),
    'titles_granted', to_jsonb(v_titles)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- undo_habit_log: igual ao anterior, e também estorna o bônus da missão relâmpago.
-- ─────────────────────────────────────────────────────────────
create or replace function public.undo_habit_log(p_habit_id uuid, p_local_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_log_id uuid;
  v_original public.xp_transactions%rowtype;
  v_bonus public.xp_transactions%rowtype;
  v_coin public.coin_transactions%rowtype;
  v_key text;
  v_reverted integer := 0;
  v_coins_reverted integer := 0;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível desfazer hoje ou ontem' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || p_local_date::text));

  delete from public.habit_logs
  where habit_id = p_habit_id and local_date = p_local_date and user_id = v_user
  returning id into v_log_id;

  if v_log_id is not null then
    -- XP da missão e da missão relâmpago
    foreach v_key in array array['habit-log:' || v_log_id::text, 'flash:' || v_log_id::text] loop
      select * into v_original from public.xp_transactions where idempotency_key = v_key;
      if found then
        insert into public.xp_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
        values (v_user, -v_original.amount, 'reversal', v_log_id, p_local_date, 'reversal:' || v_original.idempotency_key)
        on conflict (idempotency_key) do nothing;
        v_reverted := v_reverted + v_original.amount;
      end if;
    end loop;

    -- Cristais da missão e da missão relâmpago: estorna exatamente o que deram.
    foreach v_key in array array['coins:habit-log:' || v_log_id::text, 'coins:flash:' || v_log_id::text] loop
      select * into v_coin from public.coin_transactions where idempotency_key = v_key;
      if found then
        insert into public.coin_transactions (user_id, amount, source_type, source_id, local_date, idempotency_key)
        values (v_user, -v_coin.amount, 'reversal', v_log_id, p_local_date, 'reversal:' || v_coin.idempotency_key)
        on conflict (idempotency_key) do nothing;
        v_coins_reverted := v_coins_reverted + v_coin.amount;
      end if;
    end loop;

    -- O dia deixou de ser perfeito: estorna o bônus ativo (XP e Cristais da mesma ocorrência).
    if public.perfect_day_net(v_user, p_local_date) > 0 then
      select * into v_bonus
      from public.xp_transactions t
      where t.user_id = v_user and t.local_date = p_local_date and t.source_type = 'perfect_day'
        and not exists (
          select 1 from public.xp_transactions r
          where r.idempotency_key = 'reversal:' || t.idempotency_key
        )
      limit 1;

      insert into public.xp_transactions (user_id, amount, source_type, local_date, idempotency_key)
      values (v_user, -v_bonus.amount, 'reversal', p_local_date, 'reversal:' || v_bonus.idempotency_key)
      on conflict (idempotency_key) do nothing;
      v_reverted := v_reverted + v_bonus.amount;

      select * into v_coin from public.coin_transactions where idempotency_key = 'coins:' || v_bonus.idempotency_key;
      if found then
        insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
        values (v_user, -v_coin.amount, 'reversal', p_local_date, 'reversal:' || v_coin.idempotency_key)
        on conflict (idempotency_key) do nothing;
        v_coins_reverted := v_coins_reverted + v_coin.amount;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'undone', v_log_id is not null,
    'xp_reverted', v_reverted,
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_transactions where user_id = v_user),
    'coins_reverted', v_coins_reverted,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Fim da loja de classes: a classe agora vem do caminho e do estágio.
-- ─────────────────────────────────────────────────────────────
drop trigger profiles_guard_hero_class on public.profiles;
drop function public.profiles_guard_hero_class();
revoke execute on function public.buy_item(text) from authenticated;

-- Devolve os Cristais de cada classe comprada (uma vez por compra).
insert into public.coin_transactions (user_id, amount, source_type, item_id, local_date, idempotency_key)
select t.user_id, -t.amount, 'refund', t.item_id, public.user_today(t.user_id), 'refund:' || t.idempotency_key
from public.coin_transactions t
where t.source_type = 'purchase'
on conflict (idempotency_key) do nothing;

-- Contas que já passaram do onboarding: a classe atual vira o caminho (e o ramo) equivalente,
-- e o estágio é o maior que nível e missões permitem (sem ramo, no máximo 2).
select set_config('per.hero_progress', 'on', false);

update public.profiles p
set path = m.path, branch = m.branch
from (values
  ('guerreiro', 'marcial', null),
  ('paladino', 'marcial', 'A'),
  ('mago', 'arcano', null),
  ('necromante', 'arcano', 'B'),
  ('arqueiro', 'destreza', 'A'),
  ('ladino', 'destreza', 'B'),
  ('monge', 'espirito', 'A'),
  ('druida', 'natureza', null),
  ('bardo', 'cancao', null)
) as m(cls, path, branch)
where p.onboarding_done and coalesce(p.hero ->> 'heroClass', 'guerreiro') = m.cls;

update public.profiles p
set stage = least(
  public.eligible_tier(
    public.user_level(p.id),
    public.area_missions(p.id, (select areas from public.path_catalog where id = p.path))),
  case when p.branch is null then 2 else 5 end)
where p.path is not null;

insert into public.hero_history (user_id, event, path, branch, stage)
select id, 'choose', path, branch, stage from public.profiles where path is not null;

select set_config('per.hero_progress', 'off', false);

-- ─────────────────────────────────────────────────────────────
-- Permissões das funções
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.profiles_guard_hero_progress() from public, anon, authenticated;
revoke execute on function public.area_missions(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.user_level(uuid) from public, anon, authenticated;
revoke execute on function public.eligible_tier(integer, integer) from public, anon, authenticated;
revoke execute on function public.path_change_cooldown() from public, anon, authenticated;
revoke execute on function public.hero_perks(uuid) from public, anon, authenticated;
revoke execute on function public.grant_titles(uuid, date, boolean) from public, anon, authenticated;
revoke execute on function public.my_hero_path() from public, anon;
revoke execute on function public.choose_path(text, text) from public, anon;
revoke execute on function public.promote_hero(text) from public, anon;
revoke execute on function public.my_flash_mission() from public, anon;
revoke execute on function public.log_habit(uuid, date, numeric) from public, anon;
revoke execute on function public.undo_habit_log(uuid, date) from public, anon;
grant execute on function public.my_hero_path() to authenticated;
grant execute on function public.choose_path(text, text) to authenticated;
grant execute on function public.promote_hero(text) to authenticated;
grant execute on function public.my_flash_mission() to authenticated;
grant execute on function public.log_habit(uuid, date, numeric) to authenticated;
grant execute on function public.undo_habit_log(uuid, date) to authenticated;
