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
