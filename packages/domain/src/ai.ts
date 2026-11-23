/**
 * Planos da IA (prompt plan-v1). A IA só propõe; o usuário escolhe o que aceitar
 * e o banco (decide_ai_plan) cria os hábitos. Aqui o app lê o payload com segurança.
 */
import {
  DIFFICULTIES,
  HABIT_TITLE_MAX,
  normalizeScheduleDays,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_TITLE_MAX,
  type ObjectiveCategory,
} from './habits';

import type { Difficulty } from './xp';

export type AiPlanKind = 'initial' | 'weekly';
export type AiPlanStatus = 'proposed' | 'accepted' | 'rejected';

export interface AiHabitSuggestion {
  /** Posição em `payload.habits`: é o que vai para `decide_ai_plan`. */
  index: number;
  title: string;
  difficulty: Difficulty;
  scheduleDays: number[];
  objectiveTitle: string | null;
  objectiveCategory: ObjectiveCategory;
  rationale: string;
}

export interface AiPlanContent {
  summary: string;
  suggestions: AiHabitSuggestion[];
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

/**
 * Lê `ai_plans.payload`. Sugestões inválidas são descartadas, mas o `index`
 * de cada válida continua apontando para a posição original no payload.
 */
export function parseAiPlan(payload: unknown): AiPlanContent {
  const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const raw = Array.isArray(obj.habits) ? obj.habits : [];

  const suggestions: AiHabitSuggestion[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const h = item as Record<string, unknown>;
    const title = text(h.title, HABIT_TITLE_MAX);
    const days = normalizeScheduleDays(Array.isArray(h.schedule_days) ? (h.schedule_days as number[]) : []);
    const difficulty = DIFFICULTIES.includes(h.difficulty as Difficulty) ? (h.difficulty as Difficulty) : null;
    const category = OBJECTIVE_CATEGORIES.includes(h.objective_category as ObjectiveCategory)
      ? (h.objective_category as ObjectiveCategory)
      : 'personal_growth';
    if (!title || days.length === 0 || !difficulty) return;
    suggestions.push({
      index,
      title,
      difficulty,
      scheduleDays: days,
      objectiveTitle: text(h.objective_title, OBJECTIVE_TITLE_MAX) || null,
      objectiveCategory: category,
      rationale: text(h.rationale, 300),
    });
  });

  return { summary: text(obj.summary, 800), suggestions };
}

/** Só um plano ainda proposto pode ser decidido. */
export function canDecide(status: AiPlanStatus): boolean {
  return status === 'proposed';
}

// ─────────────────────────────────────────────────────────────
// Pedido do plano: o que a pessoa conta antes de gerar
// ─────────────────────────────────────────────────────────────
export const PLAN_GOAL_MAX = 300;
export const PLAN_PAST_MAX = 200;
export const PLAN_MINUTES_OPTIONS = [10, 20, 30, 60] as const;
export type PlanMinutes = (typeof PLAN_MINUTES_OPTIONS)[number];

export interface PlanRequestDraft {
  goal: string;
  minutesPerDay: PlanMinutes | null;
  freeDays: readonly number[];
  pastAttempts: string;
}

export interface PlanRequest {
  goal: string | null;
  minutes_per_day: PlanMinutes | null;
  free_days: number[];
  past_attempts: string | null;
}

/** Valida e limpa o formulário do pedido. Tudo é opcional, mas precisa de pelo menos um dia livre. */
export function normalizePlanRequest(draft: PlanRequestDraft): { value: PlanRequest | null; error: string | null } {
  const goal = draft.goal.trim().replace(/\s+/g, ' ');
  const past = draft.pastAttempts.trim().replace(/\s+/g, ' ');
  if (goal.length > PLAN_GOAL_MAX) return { value: null, error: `Use até ${PLAN_GOAL_MAX} caracteres no objetivo.` };
  if (past.length > PLAN_PAST_MAX) return { value: null, error: `Use até ${PLAN_PAST_MAX} caracteres no que já tentou.` };
  const days = normalizeScheduleDays(draft.freeDays);
  if (days.length === 0) return { value: null, error: 'Escolha pelo menos um dia livre.' };
  return {
    value: { goal: goal || null, minutes_per_day: draft.minutesPerDay, free_days: days, past_attempts: past || null },
    error: null,
  };
}

// ─────────────────────────────────────────────────────────────
// Ajustes que a pessoa faz numa sugestão antes de aceitar
// ─────────────────────────────────────────────────────────────
export interface SuggestionEdit {
  index: number;
  title: string;
  difficulty: Difficulty;
  schedule_days: number[];
}

/** Ajuste de uma sugestão no formato de `decide_ai_plan`, ou a mensagem de erro. */
export function validateSuggestionEdit(
  index: number,
  edit: { title: string; difficulty: Difficulty; scheduleDays: readonly number[] },
): { value: SuggestionEdit | null; error: string | null } {
  const title = edit.title.trim().replace(/\s+/g, ' ');
  if (!title) return { value: null, error: 'Dê um nome ao hábito.' };
  if (title.length > HABIT_TITLE_MAX) return { value: null, error: `Use no máximo ${HABIT_TITLE_MAX} caracteres.` };
  const days = normalizeScheduleDays(edit.scheduleDays);
  if (days.length === 0) return { value: null, error: 'Escolha pelo menos um dia da semana.' };
  return { value: { index, title, difficulty: edit.difficulty, schedule_days: days }, error: null };
}
