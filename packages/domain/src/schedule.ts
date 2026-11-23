import { compareLocalDates, weekday, type LocalDate } from './dates';
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
  return { total, done, ratio: total === 0 ? 0 : done / total, perfect: total > 0 && done === total };
}
