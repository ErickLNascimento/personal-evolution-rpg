/**
 * Lembretes de hábito: horário guardado em `habits.reminder_time` e
 * notificações locais agendadas no aparelho a partir dele.
 */

/** O iOS mantém só 64 notificações locais agendadas; ficamos abaixo disso. */
export const MAX_SCHEDULED_REMINDERS = 60;

export interface ReminderTime {
  hour: number;
  minute: number;
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/** Lê "08:30" ou "08:30:00" (formato do Postgres). Inválido → `null`. */
export function parseReminderTime(value: string | null | undefined): ReminderTime | null {
  const m = value ? TIME_RE.exec(value.trim()) : null;
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** "08:30" — o formato gravado no banco e mostrado na tela. */
export function formatReminderTime({ hour, minute }: ReminderTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface ReminderHabit {
  id: string;
  title: string;
  scheduleDays: readonly number[];
  archivedOn?: string | null;
  reminderTime: string | null;
  /** Repetir ao longo do dia: a cada N minutos até `reminderUntil` (missões de contar). */
  reminderEveryMinutes?: number | null;
  reminderUntil?: string | null;
}

/** Intervalos oferecidos para repetir o lembrete (iguais ao banco). */
export const REMINDER_REPEAT_MINUTES = [60, 90, 120, 180, 240] as const;
/** Fim padrão da repetição. */
export const DEFAULT_REMINDER_UNTIL = '20:00';
/** Lembretes por dia de um mesmo hábito, no máximo. */
export const MAX_REPEATS_PER_DAY = 12;
/** Dias à frente agendados para os lembretes repetidos (o app reagenda ao abrir e a cada registro). */
export const REPEAT_DAYS_AHEAD = 3;

/** O hábito repete o lembrete ao longo do dia? */
export function repeatsReminder(h: ReminderHabit): boolean {
  return Boolean(h.reminderEveryMinutes && parseReminderTime(h.reminderTime) && parseReminderTime(h.reminderUntil));
}

/** Horários do dia de um hábito: o primeiro, e os repetidos até o fim (no máximo 12). */
export function reminderTimesOfDay(h: ReminderHabit): ReminderTime[] {
  const first = parseReminderTime(h.reminderTime);
  if (!first) return [];
  const until = parseReminderTime(h.reminderUntil);
  const every = h.reminderEveryMinutes ?? 0;
  if (!until || every <= 0) return [first];
  const end = until.hour * 60 + until.minute;
  const out: ReminderTime[] = [];
  for (let m = first.hour * 60 + first.minute; m <= end && out.length < MAX_REPEATS_PER_DAY; m += every) {
    out.push({ hour: Math.floor(m / 60), minute: m % 60 });
  }
  return out;
}

export interface DatedReminder {
  habitId: string;
  title: string;
  /** Data local (AAAA-MM-DD). */
  date: string;
  hour: number;
  minute: number;
  /** Posição no dia (1…total), para o texto ("3 de 8"). */
  index: number;
  total: number;
}

/**
 * Lembretes repetidos com data, de hoje a `days` dias à frente: só nos dias da agenda, só os
 * horários que ainda não passaram e nada hoje para quem já bateu a meta (`doneToday`).
 * `weekdayOf` devolve 0 (domingo) a 6 para uma data local.
 */
export function repeatReminderDates(
  habits: readonly ReminderHabit[],
  now: { date: string; hour: number; minute: number },
  doneToday: ReadonlySet<string>,
  dates: readonly { date: string; weekday: number }[],
): DatedReminder[] {
  const out: DatedReminder[] = [];
  const nowMin = now.hour * 60 + now.minute;
  for (const h of habits) {
    if (h.archivedOn || !repeatsReminder(h)) continue;
    const times = reminderTimesOfDay(h);
    for (const d of dates) {
      if (!h.scheduleDays.includes(d.weekday)) continue;
      const isToday = d.date === now.date;
      if (isToday && doneToday.has(h.id)) continue;
      times.forEach((t, i) => {
        if (isToday && t.hour * 60 + t.minute <= nowMin) return;
        out.push({ habitId: h.id, title: h.title, date: d.date, ...t, index: i + 1, total: times.length });
      });
    }
  }
  return out.sort((a, b) => (a.date + pad(a.hour, a.minute)).localeCompare(b.date + pad(b.hour, b.minute)));
}

function pad(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

export interface ScheduledReminder {
  habitId: string;
  title: string;
  /** 1 = domingo … 7 = sábado (formato do expo-notifications); `null` = todos os dias. */
  weekday: number | null;
  hour: number;
  minute: number;
}

/**
 * Notificações a agendar: hábito todos os dias vira um lembrete diário;
 * os demais, um por dia da agenda. Arquivados e sem horário ficam de fora.
 * Acima do limite do aparelho, o excedente é cortado (`truncated`).
 */
export function reminderSchedule(
  habits: readonly ReminderHabit[],
  limit = MAX_SCHEDULED_REMINDERS,
): { reminders: ScheduledReminder[]; truncated: boolean } {
  const all: ScheduledReminder[] = [];
  for (const h of habits) {
    // Repetidos vão com data (repeatReminderDates), para parar no dia em que a meta é batida.
    if (h.archivedOn || repeatsReminder(h)) continue;
    const time = parseReminderTime(h.reminderTime);
    if (!time) continue;
    const days = [...new Set(h.scheduleDays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
    if (days.length === 0) continue;
    if (days.length === 7) {
      all.push({ habitId: h.id, title: h.title, weekday: null, ...time });
    } else {
      for (const d of days) all.push({ habitId: h.id, title: h.title, weekday: d + 1, ...time });
    }
  }
  return { reminders: all.slice(0, limit), truncated: all.length > limit };
}
