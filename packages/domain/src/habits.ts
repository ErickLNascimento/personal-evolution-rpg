/**
 * Regras de cadastro de hábitos e objetivos (Sprint 2).
 * Os limites espelham os `check` das tabelas `habits` e `objectives`.
 */
import { addDays, compareLocalDates, type LocalDate } from './dates';
import { DEFAULT_LOCALE, type Bilingual, type Locale } from './i18n';
import { formatReminderTime, parseReminderTime, REMINDER_REPEAT_MINUTES } from './reminders';
import { ALL_DAYS } from './schedule';
import type { Difficulty } from './xp';

export const HABIT_TITLE_MAX = 120;
export const OBJECTIVE_TITLE_MAX = 120;
export const UNIT_MAX = 20;

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Tipo do hábito (igual ao `check` de `habits.kind`):
 * - `do`: fazer algo; um toque conclui
 * - `avoid`: evitar algo; conclui quando o usuário confirma que resistiu no dia
 * - `count`: contador com meta inteira por dia; conclui ao bater a meta
 */
export type HabitKind = 'do' | 'avoid' | 'count';
export const HABIT_KINDS: readonly HabitKind[] = ['do', 'avoid', 'count'];
export const HABIT_KIND_LABELS: Bilingual<Record<HabitKind, string>> = {
  'pt-BR': { do: 'Fazer', avoid: 'Evitar', count: 'Contar' },
  en: { do: 'Do', avoid: 'Avoid', count: 'Count' },
};
export const HABIT_KIND_LABEL = HABIT_KIND_LABELS['pt-BR'];
export const HABIT_KIND_HINTS: Bilingual<Record<HabitKind, string>> = {
  'pt-BR': {
    do: 'Um toque conclui a missão do dia.',
    avoid: 'Algo para deixar de fazer. A missão conclui quando você confirma que resistiu no dia.',
    count: 'Some aos poucos ao longo do dia. A missão conclui ao bater a meta.',
  },
  en: {
    do: "One tap completes the day's mission.",
    avoid: 'Something to stop doing. The mission completes when you confirm you resisted that day.',
    count: 'Add up through the day. The mission completes when you hit the target.',
  },
};
export const HABIT_KIND_HINT = HABIT_KIND_HINTS['pt-BR'];
/** Maior meta de um contador (igual ao banco). */
export const COUNT_TARGET_MAX = 1000;

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

export function isObjectiveCategory(value: unknown): value is ObjectiveCategory {
  return typeof value === 'string' && (OBJECTIVE_CATEGORIES as readonly string[]).includes(value);
}

export const OBJECTIVE_CATEGORY_LABELS: Bilingual<Record<ObjectiveCategory, string>> = {
  'pt-BR': {
    health: 'Saúde',
    career: 'Carreira',
    finance: 'Finanças',
    knowledge: 'Conhecimento',
    productivity: 'Produtividade',
    relationships: 'Relacionamentos',
    wellbeing: 'Bem-estar',
    personal_growth: 'Crescimento pessoal',
  },
  en: {
    health: 'Health',
    career: 'Career',
    finance: 'Finance',
    knowledge: 'Knowledge',
    productivity: 'Productivity',
    relationships: 'Relationships',
    wellbeing: 'Well-being',
    personal_growth: 'Personal growth',
  },
};
export const OBJECTIVE_CATEGORY_LABEL = OBJECTIVE_CATEGORY_LABELS['pt-BR'];

export const DIFFICULTY_LABELS: Bilingual<Record<Difficulty, string>> = {
  'pt-BR': { easy: 'Fácil', medium: 'Média', hard: 'Difícil' },
  en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
};
export const DIFFICULTY_LABEL = DIFFICULTY_LABELS['pt-BR'];

/** Rótulos curtos dos dias, na ordem 0 = domingo … 6 = sábado. */
export const WEEKDAY_SHORTS: Bilingual<readonly string[]> = {
  'pt-BR': ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** Dias únicos, válidos e em ordem. */
export function normalizeScheduleDays(days: readonly number[]): number[] {
  return [...new Set(days)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
}

/** Liga ou desliga um dia da agenda. */
export function toggleScheduleDay(days: readonly number[], day: number): number[] {
  return normalizeScheduleDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
}

/** Descrição da agenda em português: "Todos os dias", "Dias úteis", "Seg, Qua, Sex". */
export function describeSchedule(days: readonly number[], locale: Locale = DEFAULT_LOCALE): string {
  const d = normalizeScheduleDays(days);
  const en = locale === 'en';
  if (d.length === ALL_DAYS.length) return en ? 'Every day' : 'Todos os dias';
  if (d.join() === '1,2,3,4,5') return en ? 'Weekdays' : 'Dias úteis';
  if (d.join() === '0,6') return en ? 'Weekends' : 'Fins de semana';
  return d.map((n) => WEEKDAY_SHORTS[locale][n]).join(', ');
}

/** Mensagens de validação dos formulários de hábito e objetivo. */
const FORM_MESSAGES = {
  'pt-BR': {
    habitTitle: 'Dê um nome ao hábito.',
    tooLong: (max: number) => `Use no máximo ${max} caracteres.`,
    noDays: 'Escolha pelo menos um dia da semana.',
    targetPositive: 'A meta precisa ser um número maior que zero.',
    countTarget: (max: number) => `No contador, a meta é um número inteiro de 1 a ${max}.`,
    countRequired: 'Informe quantas vezes por dia (ex.: 8).',
    unitNeedsTarget: 'Informe a meta para usar uma unidade.',
    badTime: 'Horário inválido.',
    repeatAfter: 'O fim da repetição precisa ser depois do primeiro lembrete.',
    objectiveTitle: 'Dê um nome ao objetivo.',
  },
  en: {
    habitTitle: 'Give the habit a name.',
    tooLong: (max: number) => `Use at most ${max} characters.`,
    noDays: 'Pick at least one day of the week.',
    targetPositive: 'The target must be a number greater than zero.',
    countTarget: (max: number) => `For a counter, the target is a whole number from 1 to ${max}.`,
    countRequired: 'Say how many times per day (e.g. 8).',
    unitNeedsTarget: 'Set a target to use a unit.',
    badTime: 'Invalid time.',
    repeatAfter: 'The repeat must end after the first reminder.',
    objectiveTitle: 'Give the goal a name.',
  },
} as const;

export interface HabitDraft {
  title: string;
  /** Padrão: `do`. */
  kind?: HabitKind;
  difficulty: Difficulty;
  scheduleDays: readonly number[];
  objectiveId: string | null;
  /** Meta opcional por dia, como texto digitado (ex.: "10"). */
  targetQty: string;
  unit: string;
  /** Horário do lembrete ("08:30"), ou `null`/ausente para sem lembrete. */
  reminderTime?: string | null;
  /** Repetir ao longo do dia (só missões de contar): intervalo em minutos e fim ("20:00"). */
  reminderEveryMinutes?: number | null;
  reminderUntil?: string | null;
}

export interface HabitInput {
  title: string;
  kind: HabitKind;
  difficulty: Difficulty;
  scheduleDays: number[];
  objectiveId: string | null;
  targetQty: number | null;
  unit: string | null;
  /** "HH:MM" ou `null`. */
  reminderTime: string | null;
  reminderEveryMinutes: number | null;
  reminderUntil: string | null;
}

export type HabitDraftErrors = Partial<
  Record<'title' | 'scheduleDays' | 'targetQty' | 'unit' | 'reminderTime' | 'reminderUntil', string>
>;

/** Valida e converte o formulário de hábito. Mensagens em português. */
export function validateHabitDraft(
  draft: HabitDraft,
  locale: Locale = DEFAULT_LOCALE,
): { ok: true; value: HabitInput } | { ok: false; errors: HabitDraftErrors } {
  const errors: HabitDraftErrors = {};
  const m = FORM_MESSAGES[locale];

  const title = draft.title.trim().replace(/\s+/g, ' ');
  if (!title) errors.title = m.habitTitle;
  else if (title.length > HABIT_TITLE_MAX) errors.title = m.tooLong(HABIT_TITLE_MAX);

  const scheduleDays = normalizeScheduleDays(draft.scheduleDays);
  if (scheduleDays.length === 0) errors.scheduleDays = m.noDays;

  const kind = draft.kind ?? 'do';
  // Hábito a evitar não tem meta.
  const qtyText = kind === 'avoid' ? '' : draft.targetQty.trim().replace(',', '.');
  let targetQty: number | null = null;
  if (qtyText) {
    const n = Number(qtyText);
    if (!Number.isFinite(n) || n <= 0) errors.targetQty = m.targetPositive;
    else if (kind === 'count' && (!Number.isInteger(n) || n > COUNT_TARGET_MAX))
      errors.targetQty = m.countTarget(COUNT_TARGET_MAX);
    else targetQty = n;
  } else if (kind === 'count') errors.targetQty = m.countRequired;

  const unitText = kind === 'avoid' ? '' : draft.unit.trim();
  if (unitText.length > UNIT_MAX) errors.unit = m.tooLong(UNIT_MAX);
  else if (unitText && !qtyText) errors.unit = m.unitNeedsTarget;

  let reminderTime: string | null = null;
  if (draft.reminderTime) {
    const t = parseReminderTime(draft.reminderTime);
    if (!t) errors.reminderTime = m.badTime;
    else reminderTime = formatReminderTime(t);
  }

  // Repetição: só em missão de contar, com lembrete, intervalo válido e fim depois do início.
  let reminderEveryMinutes: number | null = null;
  let reminderUntil: string | null = null;
  if (kind === 'count' && reminderTime && draft.reminderEveryMinutes && draft.reminderUntil) {
    const until = parseReminderTime(draft.reminderUntil);
    const every = draft.reminderEveryMinutes;
    if (!until) errors.reminderUntil = m.badTime;
    else if (formatReminderTime(until) <= reminderTime) errors.reminderUntil = m.repeatAfter;
    else if ((REMINDER_REPEAT_MINUTES as readonly number[]).includes(every)) {
      reminderEveryMinutes = every;
      reminderUntil = formatReminderTime(until);
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      kind,
      difficulty: draft.difficulty,
      scheduleDays,
      objectiveId: draft.objectiveId,
      targetQty,
      unit: targetQty === null || !unitText ? null : unitText,
      reminderTime,
      reminderEveryMinutes,
      reminderUntil,
    },
  };
}

/** Título do objetivo, ou mensagem de erro. */
export function validateObjectiveTitle(
  title: string,
  locale: Locale = DEFAULT_LOCALE,
): { value: string; error: string | null } {
  const value = title.trim().replace(/\s+/g, ' ');
  if (!value) return { value, error: FORM_MESSAGES[locale].objectiveTitle };
  if (value.length > OBJECTIVE_TITLE_MAX)
    return { value, error: FORM_MESSAGES[locale].tooLong(OBJECTIVE_TITLE_MAX) };
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
  if (compareLocalDates(habit.startDate, yesterday) <= 0)
    return { kind: 'archive', archivedOn: yesterday };
  return { kind: 'delete' };
}

/**
 * Valor que o contador mostra no dia. Um dia já concluído nunca aparece abaixo da meta
 * (ex.: registrado antes de o hábito virar contador).
 */
export function countShown(qty: number | undefined, target: number, done: boolean): number {
  const n = qty ?? 0;
  return done && n < target ? target : n;
}

/** "2 de 8 copos" (ou "2 de 8" sem unidade). */
export function countLabel(
  qty: number,
  target: number,
  unit?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return `${qty} ${locale === 'en' ? 'of' : 'de'} ${target}${unit ? ` ${unit}` : ''}`;
}
