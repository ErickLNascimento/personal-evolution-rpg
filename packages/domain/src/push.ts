/**
 * Push de verdade (espelha 20261127001100_push.sql; plano em docs/push/README.md).
 * Avisos chegam com o app fechado, em três categorias que a pessoa liga e desliga.
 */

export const PUSH_CATEGORIES = ['social', 'bosses', 'reengage'] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

/** Silêncio das 22h às 8h, no fuso da pessoa: o aviso espera até as 8h. */
export const PUSH_QUIET_START = 22;
export const PUSH_QUIET_END = 8;
/** Avisos de Chefes + Reengajamento por dia (os sociais não contam). */
export const PUSH_DAILY_CAP = 3;
/** Dias sem missão para o aviso de reengajamento (no máximo 1 por semana). */
export const PUSH_REENGAGE_DAYS = 3;
/** Aviso mais velho que isso na fila é descartado. */
export const PUSH_STALE_DAYS = 2;

export function isQuietHour(hour: number): boolean {
  return hour >= PUSH_QUIET_START || hour < PUSH_QUIET_END;
}

/**
 * Quantas horas esperar a partir da hora local `hour` (0–23, com minutos em `minute`) até sair
 * do silêncio. 0 fora do silêncio.
 */
export function hoursUntilAwake(hour: number, minute = 0): number {
  if (!isQuietHour(hour)) return 0;
  const now = hour + minute / 60;
  const target = hour >= PUSH_QUIET_START ? 24 + PUSH_QUIET_END : PUSH_QUIET_END;
  return target - now;
}

export interface PushDecisionInput {
  category: PushCategory;
  enabled: boolean;
  hasToken: boolean;
  localHour: number;
  /** Avisos de Chefes + Reengajamento já enviados hoje (hora da pessoa). */
  cappedSentToday: number;
  ageHours: number;
}

export type PushDecision = 'send' | 'defer' | 'skip_prefs' | 'skip_no_token' | 'skip_cap' | 'skip_stale';

/** Mesma ordem de regras de push_claim_batch no banco. */
export function pushDecision(i: PushDecisionInput): PushDecision {
  if (!i.enabled) return 'skip_prefs';
  if (!i.hasToken) return 'skip_no_token';
  if (i.ageHours > PUSH_STALE_DAYS * 24) return 'skip_stale';
  if (isQuietHour(i.localHour)) return 'defer';
  if (i.category !== 'social' && i.cappedSentToday >= PUSH_DAILY_CAP) return 'skip_cap';
  return 'send';
}
