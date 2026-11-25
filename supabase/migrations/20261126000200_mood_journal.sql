-- Diário de humor (espelha packages/domain/src/mood.ts).
--   · Um registro por dia (data local): humor de 1 a 5, sentimentos de uma lista fixa e uma nota
--     curta. Só o dono lê (RLS); nunca aparece para amigos ou grupos.
--   · Grava-se por save_mood_entry (hoje ou ontem, como as missões). O primeiro registro do dia
--     rende Cristais uma vez (coins:mood:<usuário>:<data>).
--   · Feature flag: app_settings.feature_mood_journal (1 liga, 0 desliga; começa desligada).
--     Desligada, o app esconde o diário e save_mood_entry recusa novos registros. Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_mood_journal';

create table public.mood_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_date date not null,
  mood smallint not null check (mood between 1 and 5),
  tags text[] not null default '{}'
    check (tags <@ array['motivado', 'cansado', 'ansioso', 'grato', 'calmo', 'estressado']::text[]
           and cardinality(tags) <= 6),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

alter table public.mood_entries enable row level security;
create policy "mood_entries: ler o próprio" on public.mood_entries
  for select to authenticated using (user_id = auth.uid());
revoke all on public.mood_entries from anon, authenticated;
grant select on public.mood_entries to authenticated;

insert into public.coin_rules (key, amount) values ('coin_mood_checkin', 3);
insert into public.app_settings (key, value) values ('feature_mood_journal', 0);

alter table public.coin_transactions drop constraint coin_transactions_source_type_check;
alter table public.coin_transactions add constraint coin_transactions_source_type_check
  check (source_type in ('habit', 'perfect_day', 'level_up', 'purchase', 'reversal', 'achievement',
                         'flash', 'refund', 'challenge', 'checkin'));

create or replace function public.save_mood_entry(
  p_local_date date,
  p_mood integer,
  p_tags text[] default '{}',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_tags text[];
  v_amount integer := 0;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if coalesce((select value from public.app_settings where key = 'feature_mood_journal'), 0) <> 1 then
    raise exception 'O diário de humor está desativado' using errcode = 'PR050';
  end if;
  v_today := public.user_today(v_user);
  if p_local_date > v_today or p_local_date < v_today - 1 then
    raise exception 'Só é possível registrar hoje ou ontem' using errcode = '22023';
  end if;
  if p_mood is null or p_mood not between 1 and 5 then
    raise exception 'Humor inválido' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Nota longa demais' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct t order by t), '{}') into v_tags from unnest(coalesce(p_tags, '{}')) t;
  if not v_tags <@ array['motivado', 'cansado', 'ansioso', 'grato', 'calmo', 'estressado']::text[] then
    raise exception 'Sentimento inválido' using errcode = '22023';
  end if;

  insert into public.mood_entries (user_id, local_date, mood, tags, note)
  values (v_user, p_local_date, p_mood, v_tags, v_note)
  on conflict (user_id, local_date) do update
    set mood = excluded.mood, tags = excluded.tags, note = excluded.note, updated_at = now();

  select amount into v_amount from public.coin_rules where key = 'coin_mood_checkin';
  v_amount := coalesce(v_amount, 0);
  if v_amount > 0 then
    insert into public.coin_transactions (user_id, amount, source_type, local_date, idempotency_key)
    values (v_user, v_amount, 'checkin', p_local_date, 'coins:mood:' || v_user || ':' || p_local_date)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'coins_awarded', case when v_id is null then 0 else v_amount end,
    'coin_balance', (select coalesce(sum(amount), 0) from public.coin_transactions where user_id = v_user)
  );
end;
$$;

revoke execute on function public.save_mood_entry(date, integer, text[], text) from public, anon;
grant execute on function public.save_mood_entry(date, integer, text[], text) to authenticated;
