/**
 * Regras da tela Progresso (Sprint 3): situação de cada dia, streak,
 * XP por dia e resumo semanal. Tudo calculado a partir dos hábitos,
 * dos registros e das transações de XP lidos do banco.
 */
import { addDays, compareLocalDates, startOfWeek, type LocalDate } from './dates';
import { dayProgress, missionsForDay, type Habit } from './schedule';
import {
  computeStreak,
  SHIELD_WINDOW_DAYS,
  shieldTargets,
  type DayStatus,
  type StreakOptions,
} from './streak';

export interface HabitLogEntry {
  habitId: string;
  localDate: LocalDate;
}

export interface XpEntry {
  amount: number;
  localDate: LocalDate;
}

/** Datas de `from` até `to`, inclusive, em ordem. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; compareLocalDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

function logsByDate(logs: readonly HabitLogEntry[]): Map<LocalDate, Set<string>> {
  const map = new Map<LocalDate, Set<string>>();
  for (const l of logs) {
    let set = map.get(l.localDate);
    if (!set) map.set(l.localDate, (set = new Set()));
    set.add(l.habitId);
  }
  return map;
}

/**
 * Situação de cada dia entre `from` e `to`: completo, com falta, ou sem missão.
 * Usa a agenda atual dos hábitos (início, arquivamento e dias da semana).
 */
export function dayStatuses(
  habits: readonly Habit[],
  logs: readonly HabitLogEntry[],
  from: LocalDate,
  to: LocalDate,
): Map<LocalDate, DayStatus> {
  const byDate = logsByDate(logs);
  const statuses = new Map<LocalDate, DayStatus>();
  for (const date of dateRange(from, to)) {
    const p = dayProgress(missionsForDay(habits, byDate.get(date) ?? new Set(), date));
    statuses.set(date, p.total === 0 ? 'none' : p.perfect ? 'complete' : 'missed');
  }
  return statuses;
}

/** Primeiro dia com hábito valendo, ou `null` se não há hábitos. */
export function firstHabitDate(habits: readonly Habit[]): LocalDate | null {
  let first: LocalDate | null = null;
  for (const h of habits)
    if (first === null || compareLocalDates(h.startDate, first) < 0) first = h.startDate;
  return first;
}

export interface StreakSummary {
  current: number;
  restDaysUsed: number;
  /** Escudos que seguraram a sequência. */
  shieldsUsed: number;
  /** `true` se a sequência chegou ao limite da janela lida (mostrar como "N+"). */
  capped: boolean;
}

/**
 * Streak atual olhando no máximo `windowDays` para trás.
 * Antes do primeiro hábito não há o que contar.
 */
export function streakFrom(
  habits: readonly Habit[],
  logs: readonly HabitLogEntry[],
  today: LocalDate,
  windowDays: number,
  options: StreakOptions = {},
): StreakSummary {
  const first = firstHabitDate(habits);
  if (first === null || compareLocalDates(first, today) > 0)
    return { current: 0, restDaysUsed: 0, shieldsUsed: 0, capped: false };

  const windowStart = addDays(today, -(windowDays - 1));
  const truncated = compareLocalDates(first, windowStart) < 0;
  const from = truncated ? windowStart : first;
  const statuses = dayStatuses(habits, logs, from, today);
  const result = computeStreak(statuses, today, from, options);

  // A contagem não quebrou se cada dia da janela foi completo, perdoado, protegido, sem missão
  // ou ainda em aberto (hoje e, com openDays, os dias que ainda aceitam registro).
  const openUntil = addDays(today, -(options.openDays ?? 0));
  let noneDays = 0;
  let openMissed = 0;
  for (const [date, s] of statuses) {
    if (s === 'none') noneDays += 1;
    else if (s === 'missed' && compareLocalDates(date, openUntil) >= 0) openMissed += 1;
  }
  const unbroken =
    result.current + result.restDaysUsed + result.shieldsUsed + noneDays + openMissed ===
    statuses.size;

  return { ...result, capped: truncated && unbroken };
}

/** Dias de histórico que bastam para decidir os escudos (janela + uma semana de folga). */
export const SHIELD_LOOKBACK_DAYS = SHIELD_WINDOW_DAYS + 7;

/**
 * Dias fechados em que um escudo deve ser usado agora para salvar o streak, considerando
 * ontem ainda em aberto e os dias já protegidos. Lê no máximo SHIELD_LOOKBACK_DAYS.
 */
export function streakShieldDates(
  habits: readonly Habit[],
  logs: readonly HabitLogEntry[],
  today: LocalDate,
  available: number,
  shielded: ReadonlySet<LocalDate>,
): LocalDate[] {
  const first = firstHabitDate(habits);
  if (available <= 0 || first === null || compareLocalDates(first, today) > 0) return [];
  const windowStart = addDays(today, -(SHIELD_LOOKBACK_DAYS - 1));
  const from = compareLocalDates(first, windowStart) < 0 ? windowStart : first;
  const statuses = dayStatuses(habits, logs, from, today);
  return shieldTargets(statuses, today, from, available, { openDays: 1, shielded });
}

export interface DailyXp {
  date: LocalDate;
  xp: number;
}

/** XP líquido de cada dia entre `from` e `to` (estornos descontam; dia sem XP = 0). */
export function dailyXp(entries: readonly XpEntry[], from: LocalDate, to: LocalDate): DailyXp[] {
  const sums = new Map<LocalDate, number>();
  for (const e of entries) sums.set(e.localDate, (sums.get(e.localDate) ?? 0) + e.amount);
  return dateRange(from, to).map((date) => ({ date, xp: sums.get(date) ?? 0 }));
}

export interface WeekSummary {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  /** Missões agendadas na semana (dias até `until`). */
  scheduled: number;
  completed: number;
  /** De 0 a 1; semana sem missão = 0. */
  rate: number;
  perfectDays: number;
  xp: number;
}

/**
 * Resumo de uma semana (segunda a domingo) que contém `date`.
 * Dias depois de `until` (ex.: hoje) não entram, para a semana atual não contar o futuro.
 */
export function weekSummary(
  habits: readonly Habit[],
  logs: readonly HabitLogEntry[],
  xp: readonly XpEntry[],
  date: LocalDate,
  until: LocalDate,
): WeekSummary {
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const last = compareLocalDates(weekEnd, until) <= 0 ? weekEnd : until;
  const byDate = logsByDate(logs);

  let scheduled = 0;
  let completed = 0;
  let perfectDays = 0;
  const days = compareLocalDates(weekStart, last) <= 0 ? dateRange(weekStart, last) : [];
  for (const d of days) {
    const p = dayProgress(missionsForDay(habits, byDate.get(d) ?? new Set(), d));
    scheduled += p.total;
    completed += p.done;
    if (p.perfect) perfectDays += 1;
  }

  const xpTotal = xp
    .filter(
      (e) =>
        compareLocalDates(e.localDate, weekStart) >= 0 && compareLocalDates(e.localDate, last) <= 0,
    )
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    weekStart,
    weekEnd,
    scheduled,
    completed,
    rate: scheduled === 0 ? 0 : completed / scheduled,
    perfectDays,
    xp: xpTotal,
  };
}
