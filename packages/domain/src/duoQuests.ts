/**
 * Missões em equipe (espelha 20261127001000_duo_quests.sql): um amigo convida outro para um
 * desafio da semana (segunda a domingo de quem convida). Cada um faz N missões numa área da vida
 * (ou em qualquer área); os dois precisam bater a meta. Cada um resgata o próprio prêmio depois
 * que a dupla cumpriu, até 7 dias depois do fim da semana.
 */
import { addDays, compareLocalDates, type LocalDate } from './dates';
import type { ObjectiveCategory } from './habits';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export const DUO_TARGETS = [3, 5, 7] as const;
export type DuoTarget = (typeof DUO_TARGETS)[number];
/** Missões em equipe por pessoa por semana (pendentes + aceitas). */
export const MAX_DUOS_PER_WEEK = 3;
/** Dias depois do domingo em que ainda dá para resgatar. */
export const DUO_CLAIM_DAYS = 7;

const REWARD: Record<DuoTarget, number> = { 3: 30, 5: 50, 7: 80 };

/** Cristais para cada um da dupla. */
export function duoReward(target: number): number {
  return REWARD[target as DuoTarget] ?? 0;
}

export interface DuoQuestState {
  weekStart: LocalDate;
  status: 'pending' | 'active';
  target: number;
  myDone: number;
  partnerDone: number;
  claimed: boolean;
  iInvited: boolean;
}

export type DuoPhase =
  /** Convite para mim, esperando a minha resposta. */
  | 'invited'
  /** Convidei, esperando o amigo. */
  | 'waiting'
  /** Em andamento. */
  | 'active'
  /** Os dois cumpriram: dá para resgatar. */
  | 'claimable'
  /** Resgatei. */
  | 'claimed'
  /** Acabou sem a dupla cumprir, ou o prazo de resgate passou. */
  | 'over';

export function duoPhase(q: DuoQuestState, today: LocalDate): DuoPhase {
  const weekEnd = addDays(q.weekStart, 6);
  const weekOver = compareLocalDates(today, weekEnd) > 0;
  if (q.status === 'pending') return weekOver ? 'over' : q.iInvited ? 'waiting' : 'invited';
  if (q.claimed) return 'claimed';
  const done = q.myDone >= q.target && q.partnerDone >= q.target;
  if (done) return compareLocalDates(today, addDays(weekEnd, DUO_CLAIM_DAYS)) > 0 ? 'over' : 'claimable';
  return weekOver ? 'over' : 'active';
}

/** Ordem na tela: o que pede ação primeiro. */
const PHASE_ORDER: Record<DuoPhase, number> = {
  invited: 0,
  claimable: 1,
  active: 2,
  waiting: 3,
  claimed: 4,
  over: 5,
};

export function sortDuoQuests<T extends DuoQuestState>(quests: readonly T[], today: LocalDate): T[] {
  return [...quests].sort((a, b) => PHASE_ORDER[duoPhase(a, today)] - PHASE_ORDER[duoPhase(b, today)]);
}

/** "5 missões de Saúde cada um" / "5 missions each in Health". */
export function duoGoalText(
  target: number,
  category: ObjectiveCategory | null,
  categoryLabel: (c: ObjectiveCategory) => string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale === 'en')
    return category
      ? `${target} ${categoryLabel(category)} missions each`
      : `${target} missions each`;
  return category
    ? `${target} missões de ${categoryLabel(category)} cada um`
    : `${target} missões cada um`;
}
