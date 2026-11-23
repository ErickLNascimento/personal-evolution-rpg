import type { LocalDate } from './dates';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Tabela de XP. Os valores reais vêm do backend; este é o padrão da Fase 1. */
export interface XpTable {
  habit: Record<Difficulty, number>;
  perfectDayBonus: number;
}

export const DEFAULT_XP_TABLE: XpTable = {
  habit: { easy: 10, medium: 20, hard: 30 },
  perfectDayBonus: 20,
};

export function xpForHabit(difficulty: Difficulty, table: XpTable = DEFAULT_XP_TABLE): number {
  return table.habit[difficulty];
}

/**
 * Chaves de idempotência. O banco tem `xp_transactions.idempotency_key` único,
 * e `habit_logs` é único por (hábito, data local): cada ocorrência gera no máximo
 * um registro, e cada registro concede XP uma única vez.
 * Desfazer apaga o registro e grava um estorno; registrar de novo cria um registro novo.
 */
export function habitLogXpKey(logId: string): string {
  return `habit-log:${logId}`;
}

/** Bônus de dia perfeito; `occurrence` cresce se o dia deixar de ser e voltar a ser perfeito. */
export function perfectDayXpKey(userId: string, date: LocalDate, occurrence = 1): string {
  return `perfect-day:${userId}:${date}:${occurrence}`;
}

/** Chave do estorno de uma transação (desfazer). */
export function reversalKey(originalKey: string): string {
  return `reversal:${originalKey}`;
}

export interface XpTransaction {
  amount: number;
  idempotencyKey: string;
}

/** Saldo = soma das transações; chaves repetidas contam uma vez só. */
export function xpBalance(transactions: readonly XpTransaction[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const tx of transactions) {
    if (seen.has(tx.idempotencyKey)) continue;
    seen.add(tx.idempotencyKey);
    total += tx.amount;
  }
  return total;
}

/**
 * Monta a tabela de XP a partir das linhas de `xp_rules` do banco.
 * Chave ausente ou inválida usa o padrão da Fase 1.
 */
export function xpTableFromRules(rows: readonly { key: string; amount: number }[]): XpTable {
  const byKey = new Map(rows.map((r) => [r.key, r.amount]));
  const pick = (key: string, fallback: number) => {
    const v = byKey.get(key);
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : fallback;
  };
  return {
    habit: {
      easy: pick('habit_easy', DEFAULT_XP_TABLE.habit.easy),
      medium: pick('habit_medium', DEFAULT_XP_TABLE.habit.medium),
      hard: pick('habit_hard', DEFAULT_XP_TABLE.habit.hard),
    },
    perfectDayBonus: pick('perfect_day_bonus', DEFAULT_XP_TABLE.perfectDayBonus),
  };
}
