-- Sprint 2: protege o histórico de hábitos.
-- Excluir um hábito apaga os registros em cascata, mas o XP ficaria sem origem;
-- por isso hábito com registro só pode ser arquivado. E as datas de início/arquivamento
-- não podem deixar registros existentes fora do período em que o hábito valia.

create or replace function public.habits_guard_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_first date;
  v_last date;
begin
  if tg_op = 'DELETE' then
    -- Exclusão em cascata da conta inteira (perfil já removido) é permitida.
    if not exists (select 1 from public.profiles where id = old.user_id) then
      return old;
    end if;
    if exists (select 1 from public.habit_logs where habit_id = old.id) then
      raise exception 'Hábito com registros não pode ser excluído; arquive-o.' using errcode = '23001';
    end if;
    return old;
  end if;

  select min(local_date), max(local_date) into v_first, v_last
  from public.habit_logs where habit_id = new.id;

  if v_first is not null and new.start_date > v_first then
    raise exception 'O início não pode ser depois do primeiro registro (%).', v_first using errcode = '23514';
  end if;
  if v_last is not null and new.archived_on is not null and new.archived_on < v_last then
    raise exception 'O arquivamento não pode ser antes do último registro (%).', v_last using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger habits_guard_delete before delete on public.habits
  for each row execute function public.habits_guard_history();

create trigger habits_guard_dates before update of start_date, archived_on on public.habits
  for each row execute function public.habits_guard_history();

revoke execute on function public.habits_guard_history() from public, anon, authenticated;
