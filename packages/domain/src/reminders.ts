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
    if (h.archivedOn) continue;
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
