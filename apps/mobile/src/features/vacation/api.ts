import type { PostgrestError } from '@supabase/supabase-js';
import { VACATION_DAYS_PER_YEAR, VACATION_MAX_DAYS, type LocalDate, type Vacation } from '@per/domain';
import type { Result } from '@/features/habits/api';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Modo férias: períodos em public.vacations (só os do próprio usuário: RLS). Grava-se só pelas
 * funções do banco start_vacation e end_vacation, que conferem a flag feature_vacation.
 */
function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  switch (error.code) {
    case 'PR050':
      return { data: null, error: t('vacation.errorOff') };
    case 'PR060':
      return { data: null, error: t('vacation.errorStart') };
    case 'PR061':
      return { data: null, error: t('vacation.errorLength', { max: VACATION_MAX_DAYS }) };
    case 'PR062':
      return { data: null, error: t('vacation.errorOverlap') };
    case 'PR063':
      return { data: null, error: t('vacation.errorYear', { max: VACATION_DAYS_PER_YEAR }) };
    case 'P0002':
      return { data: null, error: t('vacation.errorGone') };
  }
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
  return { data: null, error: fallback };
}

interface Row {
  id: string;
  start_date: string;
  end_date: string;
}

const fromRow = (r: Row): Vacation => ({ id: r.id, startDate: r.start_date, endDate: r.end_date });

/** Banco ainda sem a migration das férias: a tabela não existe. */
const MISSING_TABLE = new Set(['PGRST205', '42P01']);

/** Todas as férias do usuário (passadas e futuras), da mais antiga para a mais nova. */
export async function listVacations(): Promise<Result<Vacation[]>> {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await client()
    .from('vacations')
    .select('id, start_date, end_date')
    .order('start_date')
    .returns<Row[]>();
  if (error) {
    if (MISSING_TABLE.has(error.code)) return { data: [], error: null };
    return failure(error, t('vacation.errorLoad'));
  }
  return { data: data.map(fromRow), error: null };
}

export async function startVacation(start: LocalDate, days: number): Promise<Result<Vacation>> {
  const { data, error } = await client().rpc('start_vacation', { p_start: start, p_days: days });
  if (error) return failure(error, t('vacation.errorSave'));
  return { data: fromRow(data as Row), error: null };
}

export async function endVacation(id: string): Promise<Result<true>> {
  const { error } = await client().rpc('end_vacation', { p_id: id });
  if (error) return failure(error, t('vacation.errorSave'));
  return { data: true, error: null };
}
