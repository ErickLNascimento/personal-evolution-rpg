import { addDays, compareLocalDates, startOfWeek, type LocalDate } from './dates';

/**
 * Situação de um dia para o streak:
 * - `complete`: todas as missões agendadas foram concluídas
 * - `missed`: havia missão agendada e ao menos uma ficou sem registro
 * - `none`: nenhuma missão agendada (não conta nem quebra)
 */
export type DayStatus = 'complete' | 'missed' | 'none';

export interface StreakOptions {
  /** Faltas perdoadas por semana (segunda a domingo). Padrão: 1. */
  restDaysPerWeek?: number;
  /**
   * Dias antes de hoje que ainda aceitam registro (ontem = 1). Como hoje, uma falta neles
   * não quebra a sequência: o dia ainda pode ser completado. Padrão: 0.
   */
  openDays?: number;
  /** Dias cobertos por um escudo de streak: a falta não soma nem quebra. */
  shielded?: ReadonlySet<LocalDate>;
}

export interface StreakResult {
  /** Dias completos na sequência atual. */
  current: number;
  /** Faltas perdoadas usadas dentro da sequência. */
  restDaysUsed: number;
  /** Escudos que seguraram a sequência. */
  shieldsUsed: number;
}

/** Até quantos dias atrás um escudo pode cobrir uma falta (igual ao banco). */
export const SHIELD_WINDOW_DAYS = 7;
/** Escudos guardados ao mesmo tempo, no máximo (igual ao banco). */
export const MAX_STREAK_SHIELDS = 2;

/**
 * Calcula o streak contando para trás a partir de `today`.
 * - Hoje incompleto não quebra (o dia ainda está em andamento).
 * - Até `restDaysPerWeek` faltas por semana são perdoadas: não somam, mas não quebram.
 * - Dias antes de `firstDate` (início do uso) encerram a contagem.
 */
export function computeStreak(
  statusByDate: ReadonlyMap<LocalDate, DayStatus>,
  today: LocalDate,
  firstDate: LocalDate,
  options: StreakOptions = {},
): StreakResult {
  const allowance = options.restDaysPerWeek ?? 1;
  const openUntil = addDays(today, -(options.openDays ?? 0));
  const shielded = options.shielded ?? new Set<LocalDate>();
  const forgivenByWeek = new Map<LocalDate, number>();
  let current = 0;
  let restDaysUsed = 0;
  let shieldsUsed = 0;

  for (let d = today; compareLocalDates(d, firstDate) >= 0; d = addDays(d, -1)) {
    const status = statusByDate.get(d) ?? 'missed';
    if (status === 'complete') {
      current += 1;
      continue;
    }
    if (status === 'none') continue;
    if (compareLocalDates(d, openUntil) >= 0) continue; // ainda dá para registrar
    if (shielded.has(d)) {
      shieldsUsed += 1;
      continue;
    }

    const week = startOfWeek(d);
    const used = forgivenByWeek.get(week) ?? 0;
    if (used < allowance) {
      forgivenByWeek.set(week, used + 1);
      restDaysUsed += 1;
      continue;
    }
    break;
  }

  return { current, restDaysUsed, shieldsUsed };
}

/**
 * Dias fechados em que um escudo salvaria a sequência, na ordem em que seriam usados
 * (do mais recente para o mais antigo), até `available` escudos. Só dentro da janela de
 * SHIELD_WINDOW_DAYS; uma quebra mais antiga encerra a busca.
 */
export function shieldTargets(
  statusByDate: ReadonlyMap<LocalDate, DayStatus>,
  today: LocalDate,
  firstDate: LocalDate,
  available: number,
  options: StreakOptions = {},
): LocalDate[] {
  const targets: LocalDate[] = [];
  const shielded = new Set(options.shielded ?? []);
  const oldest = addDays(today, -SHIELD_WINDOW_DAYS);
  while (targets.length < available) {
    const brokeAt = breakDate(statusByDate, today, firstDate, { ...options, shielded });
    if (!brokeAt || compareLocalDates(brokeAt, oldest) < 0) break;
    targets.push(brokeAt);
    shielded.add(brokeAt);
  }
  return targets;
}

/** Dia que encerra a sequência (a falta não perdoada mais recente), ou null. */
function breakDate(
  statusByDate: ReadonlyMap<LocalDate, DayStatus>,
  today: LocalDate,
  firstDate: LocalDate,
  options: StreakOptions,
): LocalDate | null {
  // Mesma caminhada de computeStreak, parando no dia que quebra a sequência.
  const allowance = options.restDaysPerWeek ?? 1;
  const openUntil = addDays(today, -(options.openDays ?? 0));
  const shielded = options.shielded ?? new Set<LocalDate>();
  const forgivenByWeek = new Map<LocalDate, number>();
  for (let d = today; compareLocalDates(d, firstDate) >= 0; d = addDays(d, -1)) {
    const status = statusByDate.get(d) ?? 'missed';
    if (status !== 'missed') continue;
    if (compareLocalDates(d, openUntil) >= 0 || shielded.has(d)) continue;
    const week = startOfWeek(d);
    const used = forgivenByWeek.get(week) ?? 0;
    if (used < allowance) {
      forgivenByWeek.set(week, used + 1);
      continue;
    }
    return d;
  }
  return null;
}
