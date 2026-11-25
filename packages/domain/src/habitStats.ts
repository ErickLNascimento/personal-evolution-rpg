import { addDays, compareLocalDates, startOfWeek, type LocalDate } from './dates';
import { isHabitScheduledOn, LOGGABLE_DAYS_BACK, type Habit } from './schedule';

/**
 * Situação de um dia no histórico de um hábito:
 * - `done`: registrado
 * - `missed`: estava na agenda, não foi registrado e o prazo de registro já passou
 * - `open`: está na agenda e ainda dá para registrar (hoje ou ontem)
 * - `off`: fora da agenda (não conta)
 * - `outside`: antes do início, depois do arquivamento ou no futuro
 */
export type HabitDayStatus = 'done' | 'missed' | 'open' | 'off' | 'outside';

export interface HabitStats {
  /** Dias agendados já fechados, mais os dias em aberto que já foram feitos. */
  scheduled: number;
  /** Registros dentro do período do hábito. */
  done: number;
  /** done / scheduled, de 0 a 1; `null` sem nenhum dia para avaliar. */
  rate: number | null;
  /** A mesma taxa, só nos últimos RECENT_DAYS dias. */
  recentRate: number | null;
  /** Dias agendados seguidos feitos até hoje (dias fora da agenda não quebram). */
  currentStreak: number;
  /** A maior sequência de todo o histórico. */
  bestStreak: number;
}

/** Janela da taxa recente. */
export const RECENT_DAYS = 30;
/** Semanas no mapa de calor da tela do hábito. */
export const HEATMAP_WEEKS = 12;

/** Último dia em que o hábito pode ter dado algo: hoje, ou o arquivamento se veio antes. */
function lastDay(habit: Habit, today: LocalDate): LocalDate {
  return habit.archivedOn && compareLocalDates(habit.archivedOn, today) < 0 ? habit.archivedOn : today;
}

export function habitDayStatus(
  habit: Habit,
  logged: ReadonlySet<LocalDate>,
  date: LocalDate,
  today: LocalDate,
): HabitDayStatus {
  if (compareLocalDates(date, today) > 0 || compareLocalDates(date, habit.startDate) < 0) return 'outside';
  if (habit.archivedOn && compareLocalDates(date, habit.archivedOn) > 0) return 'outside';
  if (logged.has(date)) return 'done';
  if (!isHabitScheduledOn(habit, date)) return 'off';
  return compareLocalDates(date, addDays(today, -LOGGABLE_DAYS_BACK)) >= 0 ? 'open' : 'missed';
}

export function habitStats(habit: Habit, logged: ReadonlySet<LocalDate>, today: LocalDate): HabitStats {
  const end = lastDay(habit, today);
  const recentFrom = addDays(today, -(RECENT_DAYS - 1));
  let scheduled = 0;
  let done = 0;
  let recentScheduled = 0;
  let recentDone = 0;
  let run = 0;
  let bestStreak = 0;

  for (let d = habit.startDate; compareLocalDates(d, end) <= 0; d = addDays(d, 1)) {
    const status = habitDayStatus(habit, logged, d, today);
    const recent = compareLocalDates(d, recentFrom) >= 0;
    if (status === 'done') {
      scheduled += 1;
      done += 1;
      if (recent) {
        recentScheduled += 1;
        recentDone += 1;
      }
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else if (status === 'missed') {
      scheduled += 1;
      if (recent) recentScheduled += 1;
      run = 0;
    }
    // 'open' e 'off' não contam nem quebram a sequência.
  }

  return {
    scheduled,
    done,
    rate: scheduled === 0 ? null : done / scheduled,
    recentRate: recentScheduled === 0 ? null : recentDone / recentScheduled,
    currentStreak: run,
    bestStreak,
  };
}

export interface HeatmapWeek {
  /** Segunda-feira da semana. */
  start: LocalDate;
  /** Sete dias, de segunda a domingo. */
  days: { date: LocalDate; status: HabitDayStatus }[];
}

/** As últimas `weeks` semanas (a mais antiga primeiro), terminando na semana de hoje. */
export function habitHeatmap(
  habit: Habit,
  logged: ReadonlySet<LocalDate>,
  today: LocalDate,
  weeks = HEATMAP_WEEKS,
): HeatmapWeek[] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(first, 7 * w);
    return {
      start,
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, status: habitDayStatus(habit, logged, date, today) };
      }),
    };
  });
}
