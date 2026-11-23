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
}

export interface StreakResult {
  /** Dias completos na sequência atual. */
  current: number;
  /** Faltas perdoadas usadas dentro da sequência. */
  restDaysUsed: number;
}

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
  const forgivenByWeek = new Map<LocalDate, number>();
  let current = 0;
  let restDaysUsed = 0;

  for (let d = today; compareLocalDates(d, firstDate) >= 0; d = addDays(d, -1)) {
    const status = statusByDate.get(d) ?? 'missed';
    if (status === 'complete') {
      current += 1;
      continue;
    }
    if (status === 'none') continue;
    if (d === today) continue;

    const week = startOfWeek(d);
    const used = forgivenByWeek.get(week) ?? 0;
    if (used < allowance) {
      forgivenByWeek.set(week, used + 1);
      restDaysUsed += 1;
      continue;
    }
    break;
  }

  return { current, restDaysUsed };
}
