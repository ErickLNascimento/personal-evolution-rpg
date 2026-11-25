/**
 * Emboscadas (espelha 20261127000600_ambush.sql; documento "Chefes a longo prazo", camada 4).
 * De vez em quando um minichefe aparece por 2 dias com um desafio curto. O sorteio é do banco
 * (my_ambush: em média 1 a cada 3 semanas, numa quarta ou num sábado, nunca nas 2 primeiras semanas
 * de uso nem nas férias); aqui ficam o catálogo, o progresso e os textos para a tela.
 */
import { addDays, compareLocalDates, type LocalDate } from './dates';
import type { Difficulty } from './xp';
import type { ObjectiveCategory } from './habits';
import { DEFAULT_LOCALE, type Bilingual, type Locale } from './i18n';
import { dayProgress, missionsForDay, type Habit } from './schedule';

export const AMBUSH_DAYS = 2;

export type AmbusherId = 'goblin' | 'slime' | 'morcego' | 'diabrete' | 'esqueleto';

export type AmbushGoal =
  | { kind: 'missions'; count: number; category?: ObjectiveCategory; difficulty?: Difficulty }
  | { kind: 'perfect_days'; count: number };

export interface Ambusher {
  id: AmbusherId;
  name: Bilingual;
  /** Frase do minichefe. */
  taunt: Bilingual;
  goal: AmbushGoal;
  /** Cristais do resgate (o banco paga o mesmo). */
  reward: number;
}

/** Mesma ordem do array em ambush_for_week (o sorteio escolhe pelo índice). */
export const AMBUSHERS: readonly Ambusher[] = [
  {
    id: 'goblin',
    name: { 'pt-BR': 'Goblin do Atraso', en: 'Goblin of Lateness' },
    taunt: { 'pt-BR': 'Ainda dá tempo... depois.', en: 'There is still time... later.' },
    goal: { kind: 'missions', count: 4 },
    reward: 20,
  },
  {
    id: 'slime',
    name: { 'pt-BR': 'Slime da Bagunça', en: 'Slime of Clutter' },
    taunt: { 'pt-BR': 'Deixa tudo onde está.', en: 'Just leave everything where it is.' },
    goal: { kind: 'missions', count: 3, category: 'productivity' },
    reward: 15,
  },
  {
    id: 'morcego',
    name: { 'pt-BR': 'Morcego da Madrugada', en: 'Bat of the Small Hours' },
    taunt: { 'pt-BR': 'Só mais um pouco acordado.', en: 'Stay up just a little longer.' },
    goal: { kind: 'perfect_days', count: 2 },
    reward: 25,
  },
  {
    id: 'diabrete',
    name: { 'pt-BR': 'Diabrete do Celular', en: 'Imp of the Phone' },
    taunt: { 'pt-BR': 'Olha só essa notificação!', en: 'Look at this notification!' },
    goal: { kind: 'missions', count: 3, category: 'wellbeing' },
    reward: 20,
  },
  {
    id: 'esqueleto',
    name: { 'pt-BR': 'Esqueleto do "Depois"', en: 'Skeleton of "Later"' },
    taunt: { 'pt-BR': 'Amanhã você faz o difícil.', en: 'Do the hard one tomorrow.' },
    goal: { kind: 'missions', count: 2, difficulty: 'hard' },
    reward: 20,
  },
];

export function ambusher(id: string): Ambusher | undefined {
  return AMBUSHERS.find((a) => a.id === id);
}

export interface Ambush {
  ambusher: Ambusher;
  startDate: LocalDate;
  /** Último dia (inclusivo) do desafio. */
  endDate: LocalDate;
  claimed: boolean;
  /** Emboscada de mentira do build de desenvolvimento (dev_ambush_preview): sem resgate. */
  preview?: boolean;
}

/** Situação da emboscada em `today`: por vir, em andamento ou encerrada (dia de resgate). */
export function ambushPhase(a: Pick<Ambush, 'startDate' | 'endDate'>, today: LocalDate): 'upcoming' | 'active' | 'ended' {
  if (compareLocalDates(today, a.startDate) < 0) return 'upcoming';
  if (compareLocalDates(today, a.endDate) <= 0) return 'active';
  return 'ended';
}

/** Progresso do desafio nos dias da emboscada (mesma conta de ambush_progress no banco). */
export function ambushProgress(
  a: Pick<Ambush, 'ambusher' | 'startDate' | 'endDate'>,
  habits: readonly Habit[],
  logged: ReadonlyMap<LocalDate, ReadonlySet<string>>,
): { done: number; target: number; complete: boolean } {
  const goal = a.ambusher.goal;
  let done = 0;
  for (let d = a.startDate; compareLocalDates(d, a.endDate) <= 0; d = addDays(d, 1)) {
    const ids = logged.get(d) ?? new Set<string>();
    if (goal.kind === 'perfect_days') {
      if (dayProgress(missionsForDay(habits, ids, d)).perfect) done += 1;
      continue;
    }
    for (const h of habits) {
      if (!ids.has(h.id)) continue;
      if (goal.category && h.category !== goal.category) continue;
      if (goal.difficulty && h.difficulty !== goal.difficulty) continue;
      done += 1;
    }
  }
  return { done: Math.min(done, goal.count), target: goal.count, complete: done >= goal.count };
}

/** "4 missões", "3 missões de Produtividade", "2 dias perfeitos", "2 missões difíceis". */
export function ambushGoalText(
  goal: AmbushGoal,
  categoryLabel: (c: ObjectiveCategory) => string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const en = locale === 'en';
  if (goal.kind === 'perfect_days')
    return en ? `${goal.count} perfect days` : `${goal.count} dias perfeitos`;
  if (goal.difficulty === 'hard')
    return en ? `${goal.count} hard missions` : `${goal.count} missões difíceis`;
  if (goal.category)
    return en
      ? `${goal.count} ${categoryLabel(goal.category)} missions`
      : `${goal.count} missões de ${categoryLabel(goal.category)}`;
  return en ? `${goal.count} missions` : `${goal.count} missões`;
}

/** Lê a resposta de my_ambush (null = nenhuma). */
export function parseAmbush(raw: unknown): Ambush | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const a = typeof r.ambusher === 'string' ? ambusher(r.ambusher) : undefined;
  if (!a || typeof r.start_date !== 'string' || typeof r.end_date !== 'string') return null;
  return { ambusher: a, startDate: r.start_date, endDate: r.end_date, claimed: r.claimed === true };
}
