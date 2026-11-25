/**
 * Lorde do mês (espelha 20261127000800_monthly_boss.sql; documento "Chefes a longo prazo",
 * camada 5). Um chefe do rodízio na forma lendária fica o mês inteiro, em paralelo aos chefes da
 * semana: vida de MONTHLY_HP_PCT% das missões agendadas no mês, cada missão feita tira 1, e o
 * prêmio é resgatado até o dia MONTHLY_CLAIM_DAYS do mês seguinte.
 */
import { ACT_II_BOSSES, BOSSES, actTwoActive, type Boss } from './challenges';
import { addDays, compareLocalDates, type LocalDate } from './dates';
import { isHabitScheduledOn, type Habit } from './schedule';

export const MONTHLY_HP_PCT = 70;
export const MONTHLY_REWARD = 200;
/** Dias do mês seguinte em que ainda dá para resgatar. */
export const MONTHLY_CLAIM_DAYS = 7;

/** Primeiro dia do mês da data ("2026-11-25" → "2026-11-01"). */
export function monthStart(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

/** Último dia do mês que começa em `start`. */
export function monthEnd(start: LocalDate): LocalDate {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return addDays(next, -1);
}

export function previousMonthStart(start: LocalDate): LocalDate {
  return monthStart(addDays(start, -1));
}

/** Número do mês desde 1970 (jan/1970 = 0): a mesma conta de monthly_boss_for no banco. */
export function monthNumber(start: LocalDate): number {
  return (Number(start.slice(0, 4)) - 1970) * 12 + Number(start.slice(5, 7)) - 1;
}

/**
 * Lorde do mês: gira pelos chefes, igual para todos. Com o Ato II já no rodízio no começo do mês,
 * pelos 12; senão, pelos 6 do Ato I. `act2StartWeek` segue o calendário de bossForWeek.
 */
export function monthlyBossFor(start: LocalDate, act2StartWeek?: number): Boss {
  const list = actTwoActive(start, act2StartWeek) ? [...BOSSES, ...ACT_II_BOSSES] : BOSSES;
  const n = monthNumber(start);
  return list[((n % list.length) + list.length) % list.length]!;
}

export interface MonthlyBoss {
  boss: Boss;
  monthStart: LocalDate;
  monthEnd: LocalDate;
  maxHp: number;
  damage: number;
  hp: number;
  defeated: boolean;
}

/** Situação do Lorde do mês que começa em `start` (dias depois de `until` ainda não contam vida). */
export function monthlyBoss(
  habits: readonly Habit[],
  logged: ReadonlyMap<LocalDate, ReadonlySet<string>>,
  start: LocalDate,
  boss: Boss = monthlyBossFor(start),
): MonthlyBoss {
  const end = monthEnd(start);
  let scheduled = 0;
  let damage = 0;
  for (let d = start; compareLocalDates(d, end) <= 0; d = addDays(d, 1)) {
    const done = logged.get(d);
    for (const h of habits) {
      if (!isHabitScheduledOn(h, d)) continue;
      scheduled += 1;
      if (done?.has(h.id)) damage += 1;
    }
  }
  const maxHp = Math.ceil((scheduled * MONTHLY_HP_PCT) / 100);
  return {
    boss,
    monthStart: start,
    monthEnd: end,
    maxHp,
    damage,
    hp: Math.max(0, maxHp - damage),
    defeated: maxHp > 0 && damage >= maxHp,
  };
}

/** Ainda dá para resgatar o Lorde do mês que começou em `start`? */
export function monthlyClaimOpen(start: LocalDate, today: LocalDate): boolean {
  if (compareLocalDates(today, start) < 0) return false;
  return compareLocalDates(today, addDays(monthEnd(start), MONTHLY_CLAIM_DAYS)) <= 0;
}
