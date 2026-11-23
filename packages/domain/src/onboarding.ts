/**
 * Onboarding: primeiro acesso guiado. O usuário escolhe áreas de foco,
 * dificuldade preferida e, se quiser, hábitos a partir de modelos prontos.
 */
import { OBJECTIVE_CATEGORY_LABEL, type ObjectiveCategory } from './habits';
import type { Difficulty } from './xp';

export const FOCUS_AREAS_MAX = 3;
export const ONBOARDING_STEPS = 4;

export interface HabitTemplate {
  /** Identificador estável do modelo (categoria + posição). */
  id: string;
  category: ObjectiveCategory;
  title: string;
  difficulty: Difficulty;
  scheduleDays: number[];
}

const ALL = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

const TEMPLATES: Record<ObjectiveCategory, Omit<HabitTemplate, 'id' | 'category'>[]> = {
  health: [
    { title: 'Beber 2 L de água', difficulty: 'easy', scheduleDays: ALL },
    { title: 'Caminhar 20 minutos', difficulty: 'medium', scheduleDays: [1, 3, 5] },
  ],
  career: [
    { title: 'Organizar as tarefas do dia', difficulty: 'easy', scheduleDays: WEEKDAYS },
    { title: 'Estudar algo da minha área por 20 min', difficulty: 'medium', scheduleDays: WEEKDAYS },
  ],
  finance: [
    { title: 'Anotar os gastos do dia', difficulty: 'easy', scheduleDays: ALL },
    { title: 'Revisar o orçamento da semana', difficulty: 'medium', scheduleDays: [0] },
  ],
  knowledge: [
    { title: 'Ler 10 páginas', difficulty: 'easy', scheduleDays: ALL },
    { title: 'Estudar um idioma por 15 min', difficulty: 'medium', scheduleDays: WEEKDAYS },
  ],
  productivity: [
    { title: 'Planejar o dia em 5 minutos', difficulty: 'easy', scheduleDays: WEEKDAYS },
    { title: '1 hora de foco sem celular', difficulty: 'hard', scheduleDays: WEEKDAYS },
  ],
  relationships: [
    { title: 'Mandar mensagem para alguém querido', difficulty: 'easy', scheduleDays: ALL },
    { title: 'Ligar ou encontrar um amigo', difficulty: 'medium', scheduleDays: [6] },
  ],
  wellbeing: [
    { title: 'Meditar 5 minutos', difficulty: 'easy', scheduleDays: ALL },
    { title: 'Dormir antes das 23h', difficulty: 'medium', scheduleDays: ALL },
  ],
  personal_growth: [
    { title: 'Escrever 3 linhas no diário', difficulty: 'easy', scheduleDays: ALL },
    { title: 'Revisar a semana', difficulty: 'medium', scheduleDays: [0] },
  ],
};

/** Modelos de hábito das áreas escolhidas, na ordem das áreas. */
export function templatesFor(focusAreas: readonly ObjectiveCategory[]): HabitTemplate[] {
  return focusAreas.flatMap((category) =>
    TEMPLATES[category].map((t, i) => ({ ...t, id: `${category}-${i}`, category })),
  );
}

/** Pré-seleção: o primeiro modelo de cada área (o mais fácil de começar). */
export function defaultTemplateSelection(focusAreas: readonly ObjectiveCategory[]): string[] {
  return focusAreas.map((category) => `${category}-0`);
}

/** Liga ou desliga uma área, respeitando o máximo. Ao passar do máximo, ignora. */
export function toggleFocusArea(areas: readonly ObjectiveCategory[], area: ObjectiveCategory): ObjectiveCategory[] {
  if (areas.includes(area)) return areas.filter((a) => a !== area);
  if (areas.length >= FOCUS_AREAS_MAX) return [...areas];
  return [...areas, area];
}

export function validateFocusAreas(areas: readonly ObjectiveCategory[]): string | null {
  if (areas.length === 0) return 'Escolha pelo menos uma área.';
  if (areas.length > FOCUS_AREAS_MAX) return `Escolha no máximo ${FOCUS_AREAS_MAX} áreas.`;
  return null;
}

export interface OnboardingHabit {
  title: string;
  difficulty: Difficulty;
  schedule_days: number[];
  objective_title: string;
  objective_category: ObjectiveCategory;
}

/**
 * Hábitos escolhidos no formato de `complete_onboarding`.
 * Cada hábito fica ligado a um objetivo com o nome da área (ex.: "Saúde").
 */
export function onboardingHabits(
  focusAreas: readonly ObjectiveCategory[],
  selectedIds: readonly string[],
): OnboardingHabit[] {
  const chosen = new Set(selectedIds);
  return templatesFor(focusAreas)
    .filter((t) => chosen.has(t.id))
    .map((t) => ({
      title: t.title,
      difficulty: t.difficulty,
      schedule_days: t.scheduleDays,
      objective_title: OBJECTIVE_CATEGORY_LABEL[t.category],
      objective_category: t.category,
    }));
}
