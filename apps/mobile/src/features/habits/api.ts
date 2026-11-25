import type { PostgrestError } from '@supabase/supabase-js';
import type {
  Difficulty,
  HabitInput,
  HabitKind,
  LocalDate,
  ObjectiveCategory,
  RetireAction,
  Vacation,
} from '@per/domain';
import { withVacations } from '@per/domain';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';
import { listVacations } from '@/features/vacation/api';

export interface HabitRecord {
  id: string;
  title: string;
  kind: HabitKind;
  difficulty: Difficulty;
  scheduleDays: number[];
  objectiveId: string | null;
  targetQty: number | null;
  unit: string | null;
  startDate: LocalDate;
  archivedOn: LocalDate | null;
  /** "HH:MM:SS" como vem do Postgres, ou `null`. */
  reminderTime: string | null;
  /** Área do objetivo (null = sem objetivo). */
  category?: ObjectiveCategory | null;
  /** Férias do usuário: nesses dias o hábito não fica agendado (isHabitScheduledOn). */
  vacations?: readonly Vacation[];
}

/**
 * Férias do usuário para anexar aos hábitos. Se não carregarem, os hábitos seguem sem elas
 * (as missões aparecem) em vez de a tela inteira falhar.
 */
async function vacationsOrNone(): Promise<readonly Vacation[]> {
  const r = await listVacations();
  return r.data ?? [];
}

export interface ObjectiveRecord {
  id: string;
  title: string;
  category: ObjectiveCategory;
}

interface HabitRow {
  id: string;
  title: string;
  /** Ausente em bancos sem a migration dos tipos. */
  kind?: HabitKind;
  difficulty: Difficulty;
  schedule_days: number[];
  objective_id: string | null;
  target_qty: number | string | null;
  unit: string | null;
  start_date: string;
  archived_on: string | null;
  reminder_time: string | null;
  /** Objetivo embutido (só a área), para as fraquezas dos chefes. */
  objectives?: { category: ObjectiveCategory } | null;
}

const HABIT_COLUMNS =
  'id, title, kind, difficulty, schedule_days, objective_id, target_qty, unit, start_date, archived_on, reminder_time, objectives(category)';
/** Sem `kind`, para bancos que ainda não receberam a migration dos tipos de hábito. */
const LEGACY_COLUMNS = HABIT_COLUMNS.replace(' kind,', '');
/** Postgres: coluna inexistente. */
const UNDEFINED_COLUMN = '42703';

function fromRow(row: HabitRow): HabitRecord {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind ?? 'do',
    difficulty: row.difficulty,
    scheduleDays: row.schedule_days,
    objectiveId: row.objective_id,
    // numeric pode chegar como texto pelo PostgREST
    targetQty: row.target_qty === null ? null : Number(row.target_qty),
    unit: row.unit,
    startDate: row.start_date,
    archivedOn: row.archived_on,
    reminderTime: row.reminder_time,
    category: row.objectives?.category ?? null,
  };
}

function toRow(input: HabitInput) {
  return {
    title: input.title,
    kind: input.kind,
    difficulty: input.difficulty,
    schedule_days: input.scheduleDays,
    objective_id: input.objectiveId,
    target_qty: input.targetQty,
    unit: input.unit,
    reminder_time: input.reminderTime,
  };
}

export type Result<T> = { data: T; error: null } | { data: null; error: string };

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === '23001') return { data: null, error: t('errors.hasLogs') };
  if (error.code === '23514' || error.code === '42501') return { data: null, error: fallback };
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
  return { data: null, error: fallback };
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

export async function listHabits(): Promise<Result<HabitRecord[]>> {
  const query = (columns: string) =>
    client()
      .from('habits')
      .select(columns)
      .order('created_at', { ascending: true })
      .returns<HabitRow[]>();
  const vacations = vacationsOrNone();
  let { data, error } = await query(HABIT_COLUMNS);
  if (error?.code === UNDEFINED_COLUMN) ({ data, error } = await query(LEGACY_COLUMNS));
  if (error) return failure(error, t('errors.loadHabits'));
  if (!data) return { data: null, error: t('errors.loadHabits') };
  return { data: withVacations(data.map(fromRow), await vacations), error: null };
}

export async function getHabit(id: string): Promise<Result<HabitRecord>> {
  const query = (columns: string) =>
    client().from('habits').select(columns).eq('id', id).single<HabitRow>();
  const vacations = vacationsOrNone();
  let { data, error } = await query(HABIT_COLUMNS);
  if (error?.code === UNDEFINED_COLUMN) ({ data, error } = await query(LEGACY_COLUMNS));
  if (error) return failure(error, t('errors.habitNotFound'));
  if (!data) return { data: null, error: t('errors.habitNotFound') };
  return { data: { ...fromRow(data), vacations: await vacations }, error: null };
}

export async function createHabit(
  input: HabitInput,
  startDate: LocalDate,
): Promise<Result<HabitRecord>> {
  const { data, error } = await client()
    .from('habits')
    .insert({ ...toRow(input), start_date: startDate })
    .select(HABIT_COLUMNS)
    .single<HabitRow>();
  if (error) return failure(error, t('errors.createHabit'));
  return { data: fromRow(data), error: null };
}

export async function updateHabit(id: string, input: HabitInput): Promise<Result<HabitRecord>> {
  const { data, error } = await client()
    .from('habits')
    .update(toRow(input))
    .eq('id', id)
    .select(HABIT_COLUMNS)
    .single<HabitRow>();
  if (error) return failure(error, t('errors.saveHabit'));
  return { data: fromRow(data), error: null };
}

/** `true` se o hábito tem registro na data (o RLS limita aos registros do próprio usuário). */
export async function isLoggedOn(habitId: string, date: LocalDate): Promise<Result<boolean>> {
  const { count, error } = await client()
    .from('habit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('habit_id', habitId)
    .eq('local_date', date);
  if (error) return failure(error, t('errors.checkLogs'));
  return { data: (count ?? 0) > 0, error: null };
}

/** Aplica a decisão de `retireHabit` (domínio): arquivar com a data certa ou excluir. */
export async function retire(habitId: string, action: RetireAction): Promise<Result<true>> {
  const query =
    action.kind === 'archive'
      ? client().from('habits').update({ archived_on: action.archivedOn }).eq('id', habitId)
      : client().from('habits').delete().eq('id', habitId);
  const { error } = await query;
  if (error) return failure(error, t('errors.archiveHabit'));
  return { data: true, error: null };
}

export async function listObjectives(): Promise<Result<ObjectiveRecord[]>> {
  const { data, error } = await client()
    .from('objectives')
    .select('id, title, category')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .returns<ObjectiveRecord[]>();
  if (error) return failure(error, t('errors.loadObjectives'));
  return { data, error: null };
}

export async function createObjective(
  title: string,
  category: ObjectiveCategory,
): Promise<Result<ObjectiveRecord>> {
  const { data, error } = await client()
    .from('objectives')
    .insert({ title, category })
    .select('id, title, category')
    .single<ObjectiveRecord>();
  if (error) return failure(error, t('errors.createObjective'));
  return { data, error: null };
}

/** Todas as datas em que o hábito foi registrado (para as estatísticas). */
export async function listHabitLogDates(habitId: string): Promise<Result<Set<LocalDate>>> {
  const PAGE = 1000;
  const dates = new Set<LocalDate>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client()
      .from('habit_logs')
      .select('local_date')
      .eq('habit_id', habitId)
      .order('local_date')
      .range(from, from + PAGE - 1)
      .returns<{ local_date: string }[]>();
    if (error) return failure(error, t('errors.loadHistory'));
    for (const row of data) dates.add(row.local_date);
    if (data.length < PAGE) return { data: dates, error: null };
  }
}
