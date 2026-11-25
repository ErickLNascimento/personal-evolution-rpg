import { addDays, compareLocalDates, weekday, type LocalDate } from './dates';
import type { HabitKind } from './habits';
import type { Difficulty } from './xp';

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export interface Habit {
  id: string;
  title: string;
  difficulty: Difficulty;
  /** Dias da semana em que o hábito vale (0 = domingo … 6 = sábado). */
  scheduleDays: readonly number[];
  /** Primeiro dia em que o hábito passa a valer. */
  startDate: LocalDate;
  /** Último dia em que valeu, se foi arquivado. */
  archivedOn?: LocalDate | null;
  /** Tipo do hábito; ausente = `do`. */
  kind?: HabitKind;
  /** Meta por dia (no contador, a quantidade que conclui a missão). */
  targetQty?: number | null;
  unit?: string | null;
}

export function isHabitScheduledOn(habit: Habit, date: LocalDate): boolean {
  if (compareLocalDates(date, habit.startDate) < 0) return false;
  if (habit.archivedOn && compareLocalDates(date, habit.archivedOn) > 0) return false;
  return habit.scheduleDays.includes(weekday(date));
}

export interface Mission {
  habit: Habit;
  done: boolean;
}

/** Missões do dia = hábitos agendados para a data, marcando os já registrados. */
export function missionsForDay(
  habits: readonly Habit[],
  completedHabitIds: ReadonlySet<string>,
  date: LocalDate,
): Mission[] {
  return habits
    .filter((h) => isHabitScheduledOn(h, date))
    .map((habit) => ({ habit, done: completedHabitIds.has(habit.id) }));
}

export interface DayProgress {
  total: number;
  done: number;
  /** De 0 a 1; dia sem missões conta como 0. */
  ratio: number;
  perfect: boolean;
}

export function dayProgress(missions: readonly Mission[]): DayProgress {
  const total = missions.length;
  const done = missions.filter((m) => m.done).length;
  return {
    total,
    done,
    ratio: total === 0 ? 0 : done / total,
    perfect: total > 0 && done === total,
  };
}

/** Quantos dias atrás ainda dá para registrar uma missão (hoje e ontem). */
export const LOGGABLE_DAYS_BACK = 1;

export interface WeekDay {
  date: LocalDate;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  progress: DayProgress;
  isToday: boolean;
  /** Ainda aceita registro (hoje ou ontem). */
  loggable: boolean;
}

/**
 * Os últimos `days` dias até hoje (o mais antigo primeiro), com o progresso de cada um.
 * `logged` traz os hábitos registrados por data; datas ausentes contam como nada feito.
 */
export function recentDays(
  habits: readonly Habit[],
  logged: ReadonlyMap<LocalDate, ReadonlySet<string>>,
  today: LocalDate,
  days = 7,
): WeekDay[] {
  const out: WeekDay[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const date = addDays(today, -back);
    out.push({
      date,
      weekday: weekday(date),
      progress: dayProgress(missionsForDay(habits, logged.get(date) ?? new Set(), date)),
      isToday: back === 0,
      loggable: back <= LOGGABLE_DAYS_BACK,
    });
  }
  return out;
}
