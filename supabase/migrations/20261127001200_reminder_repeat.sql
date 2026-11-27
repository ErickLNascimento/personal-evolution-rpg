-- Lembretes ao longo do dia (espelha packages/domain/src/reminders.ts): uma missão de contar (ex.:
-- 8 copos de água) pode lembrar de hora em hora, ou a cada 2, 3… horas, do horário do lembrete
-- até `reminder_until`. Os avisos do dia param quando a meta é batida (o app reagenda a cada registro).
--   · Feature flag: app_settings.feature_reminder_repeat (começa desligada). Desligada, o app não
--     mostra a opção e gravar a repetição num hábito recusa com PR050 (gatilho na tabela).
--     Para ligar:
--       update public.app_settings set value = 1 where key = 'feature_reminder_repeat';

insert into public.app_settings (key, value) values ('feature_reminder_repeat', 0);

alter table public.habits
  add column reminder_every_minutes smallint
    check (reminder_every_minutes in (30, 60, 90, 120, 180, 240)),
  add column reminder_until time,
  -- Repetição tem intervalo e fim; o fim vem depois do primeiro lembrete.
  add constraint habits_reminder_repeat_pair
    check ((reminder_every_minutes is null) = (reminder_until is null)),
  add constraint habits_reminder_repeat_after
    check (reminder_until is null or (reminder_time is not null and reminder_until > reminder_time));

create or replace function public.habits_reminder_repeat_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reminder_every_minutes is not null
     and (tg_op = 'INSERT'
          or new.reminder_every_minutes is distinct from old.reminder_every_minutes
          or new.reminder_until is distinct from old.reminder_until) then
    perform public.require_feature('feature_reminder_repeat');
  end if;
  return new;
end;
$$;

create trigger habits_reminder_repeat_flag before insert or update on public.habits
  for each row execute function public.habits_reminder_repeat_flag();

revoke execute on function public.habits_reminder_repeat_flag() from public, anon, authenticated;
