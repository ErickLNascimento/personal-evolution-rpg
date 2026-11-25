/**
 * Crônica da semana: no começo de cada semana (segunda a quarta), no topo da aba Progresso, o
 * balanço da semana anterior: manchete, missões, dias perfeitos, XP (comparados com a semana de
 * antes), o hábito mais constante e se o chefe caiu. Tudo calculado no app, sem IA.
 */
import { weeklyBoss } from './challenges';
import { addDays, compareLocalDates, startOfWeek, weekday, type LocalDate } from './dates';
import { weekSummary, type HabitLogEntry, type WeekSummary, type XpEntry } from './progress';
import { isHabitScheduledOn, type Habit } from './schedule';

export type RecapTier = 'legendary' | 'great' | 'good' | 'restart';

/** Manchete pela taxa de conclusão da semana. */
export function recapTier(rate: number): RecapTier {
  if (rate >= 0.9) return 'legendary';
  if (rate >= 0.7) return 'great';
  if (rate >= 0.4) return 'good';
  return 'restart';
}

export interface RecapHabit {
  id: string;
  title: string;
  done: number;
  scheduled: number;
}

export interface WeeklyRecap {
  /** A semana resumida (a anterior à atual). */
  week: WeekSummary;
  /** A semana antes dela, para comparar. */
  previous: WeekSummary;
  tier: RecapTier;
  /** Missões feitas a mais (ou a menos) que na semana anterior. */
  completedDelta: number;
  xpDelta: number;
  /** Hábito com a melhor taxa (ao menos 2 dias na agenda e 1 feito); null se nenhum. */
  bestHabit: RecapHabit | null;
  bossDefeated: boolean;
}

/** Dias da semana em que a crônica aparece: segunda (1) a quarta (3). */
export const RECAP_WEEKDAYS: readonly number[] = [1, 2, 3];

/** Começo da semana resumida (a segunda da semana anterior a `today`). */
export function recapWeekStart(today: LocalDate): LocalDate {
  return addDays(startOfWeek(today), -7);
}

/** Hora da crônica? De segunda a quarta, se ainda não foi vista nesta semana (`seenWeek`). */
export function shouldShowRecap(today: LocalDate, seenWeek: LocalDate | null): boolean {
  if (!RECAP_WEEKDAYS.includes(weekday(today))) return false;
  return seenWeek !== recapWeekStart(today);
}

/**
 * Resumo da semana anterior a `today`. `null` se ela não teve nenhuma missão na agenda
 * (ex.: usuário novo ou semana inteira de férias).
 */
export function weeklyRecap(
  habits: readonly Habit[],
  logs: readonly HabitLogEntry[],
  xp: readonly XpEntry[],
  today: LocalDate,
): WeeklyRecap | null {
  const start = recapWeekStart(today);
  const end = addDays(start, 6);
  const week = weekSummary(habits, logs, xp, start, end);
  if (week.scheduled === 0) return null;
  const previous = weekSummary(habits, logs, xp, addDays(start, -7), addDays(start, -1));

  const logged = new Map<LocalDate, Set<string>>();
  for (const l of logs) {
    if (compareLocalDates(l.localDate, start) < 0 || compareLocalDates(l.localDate, end) > 0) continue;
    const set = logged.get(l.localDate) ?? new Set<string>();
    set.add(l.habitId);
    logged.set(l.localDate, set);
  }

  let bestHabit: RecapHabit | null = null;
  for (const h of habits) {
    let scheduled = 0;
    let done = 0;
    for (let d = start; compareLocalDates(d, end) <= 0; d = addDays(d, 1)) {
      if (!isHabitScheduledOn(h, d)) continue;
      scheduled += 1;
      if (logged.get(d)?.has(h.id)) done += 1;
    }
    if (scheduled < 2 || done === 0) continue;
    const rate = done / scheduled;
    const bestRate = bestHabit ? bestHabit.done / bestHabit.scheduled : -1;
    if (rate > bestRate || (rate === bestRate && done > bestHabit!.done))
      bestHabit = { id: h.id, title: h.title, done, scheduled };
  }

  return {
    week,
    previous,
    tier: recapTier(week.rate),
    completedDelta: week.completed - previous.completed,
    xpDelta: week.xp - previous.xp,
    bestHabit,
    bossDefeated: weeklyBoss(habits, logged, end, start).defeated,
  };
}
