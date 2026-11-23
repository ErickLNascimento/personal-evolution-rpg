/**
 * Regras de cadastro de hábitos e objetivos (Sprint 2).
 * Os limites espelham os `check` das tabelas `habits` e `objectives`.
 */
import { addDays, compareLocalDates, type LocalDate } from './dates';
import { formatReminderTime, parseReminderTime } from './reminders';
import { ALL_DAYS } from './schedule';
import type { Difficulty } from './xp';

export const HABIT_TITLE_MAX = 120;
export const OBJECTIVE_TITLE_MAX = 120;
export const UNIT_MAX = 20;

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const OBJECTIVE_CATEGORIES = [
  'health',
  'career',
  'finance',
  'knowledge',
  'productivity',
  'relationships',
  'wellbeing',
  'personal_growth',
] as const;

export type ObjectiveCategory = (typeof OBJECTIVE_CATEGORIES)[number];

export const OBJECTIVE_CATEGORY_LABEL: Record<ObjectiveCategory, string> = {
  health: 'Saúde',
  career: 'Carreira',
  finance: 'Finanças',
  knowledge: 'Conhecimento',
  productivity: 'Produtividade',
  relationships: 'Relacionamentos',
  wellbeing: 'Bem-estar',
  personal_growth: 'Crescimento pessoal',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Média', hard: 'Difícil' };

/** Rótulos curtos dos dias, na ordem 0 = domingo … 6 = sábado. */
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Dias únicos, válidos e em ordem. */
export function normalizeScheduleDays(days: readonly number[]): number[] {
  return [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b);
}

/** Liga ou desliga um dia da agenda. */
export function toggleScheduleDay(days: readonly number[], day: number): number[] {
  return normalizeScheduleDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
}

/** Descrição da agenda em português: "Todos os dias", "Dias úteis", "Seg, Qua, Sex". */
export function describeSchedule(days: readonly number[]): string {
  const d = normalizeScheduleDays(days);
  if (d.length === ALL_DAYS.length) return 'Todos os dias';
  if (d.join() === '1,2,3,4,5') return 'Dias úteis';
  if (d.join() === '0,6') return 'Fins de semana';
  return d.map((n) => WEEKDAY_SHORT[n]).join(', ');
}

export interface HabitDraft {
  title: string;
  difficulty: Difficulty;
  scheduleDays: readonly number[];
  objectiveId: string | null;
  /** Meta opcional por dia, como texto digitado (ex.: "10"). */
  targetQty: string;
  unit: string;
  /** Horário do lembrete ("08:30"), ou `null`/ausente para sem lembrete. */
  reminderTime?: string | null;
}

export interface HabitInput {
  title: string;
  difficulty: Difficulty;
  scheduleDays: number[];
  objectiveId: string | null;
  targetQty: number | null;
  unit: string | null;
  /** "HH:MM" ou `null`. */
  reminderTime: string | null;
}

export type HabitDraftErrors = Partial<Record<'title' | 'scheduleDays' | 'targetQty' | 'unit' | 'reminderTime', string>>;

/** Valida e converte o formulário de hábito. Mensagens em português. */
export function validateHabitDraft(
  draft: HabitDraft,
): { ok: true; value: HabitInput } | { ok: false; errors: HabitDraftErrors } {
  const errors: HabitDraftErrors = {};

  const title = draft.title.trim().replace(/\s+/g, ' ');
  if (!title) errors.title = 'Dê um nome ao hábito.';
  else if (title.length > HABIT_TITLE_MAX) errors.title = `Use no máximo ${HABIT_TITLE_MAX} caracteres.`;

  const scheduleDays = normalizeScheduleDays(draft.scheduleDays);
  if (scheduleDays.length === 0) errors.scheduleDays = 'Escolha pelo menos um dia da semana.';

  const qtyText = draft.targetQty.trim().replace(',', '.');
  let targetQty: number | null = null;
  if (qtyText) {
    const n = Number(qtyText);
    if (!Number.isFinite(n) || n <= 0) errors.targetQty = 'A meta precisa ser um número maior que zero.';
    else targetQty = n;
  }

  const unitText = draft.unit.trim();
  if (unitText.length > UNIT_MAX) errors.unit = `Use no máximo ${UNIT_MAX} caracteres.`;
  else if (unitText && !qtyText) errors.unit = 'Informe a meta para usar uma unidade.';

  let reminderTime: string | null = null;
  if (draft.reminderTime) {
    const t = parseReminderTime(draft.reminderTime);
    if (!t) errors.reminderTime = 'Horário inválido.';
    else reminderTime = formatReminderTime(t);
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      difficulty: draft.difficulty,
      scheduleDays,
      objectiveId: draft.objectiveId,
      targetQty,
      unit: targetQty === null || !unitText ? null : unitText,
      reminderTime,
    },
  };
}

/** Título do objetivo, ou mensagem de erro. */
export function validateObjectiveTitle(title: string): { value: string; error: string | null } {
  const value = title.trim().replace(/\s+/g, ' ');
  if (!value) return { value, error: 'Dê um nome ao objetivo.' };
  if (value.length > OBJECTIVE_TITLE_MAX) return { value, error: `Use no máximo ${OBJECTIVE_TITLE_MAX} caracteres.` };
  return { value, error: null };
}

export type RetireAction = { kind: 'archive'; archivedOn: LocalDate } | { kind: 'delete' };

/**
 * O que fazer ao tirar um hábito da rotina hoje.
 * - Concluído hoje: arquiva com hoje como último dia (a missão feita continua contando).
 * - Já valia antes de hoje: arquiva com ontem como último dia (sai das missões de hoje).
 * - Começa hoje ou depois e não foi feito: não tem histórico, então é excluído.
 */
export function retireHabit(
  habit: { startDate: LocalDate },
  today: LocalDate,
  loggedToday: boolean,
): RetireAction {
  if (loggedToday) return { kind: 'archive', archivedOn: today };
  const yesterday = addDays(today, -1);
  if (compareLocalDates(habit.startDate, yesterday) <= 0) return { kind: 'archive', archivedOn: yesterday };
  return { kind: 'delete' };
}
