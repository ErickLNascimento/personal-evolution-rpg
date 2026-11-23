import type { ObjectiveCategory } from '@per/domain';
import type { Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

/** Registros mínimos em hábitos do objetivo para poder conquistá-lo (mesmo valor do banco). */
export const OBJECTIVE_MIN_LOGS = 10;

export interface ObjectiveProgress {
  id: string;
  title: string;
  category: ObjectiveCategory;
  logs: number;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

export async function fetchObjectivesProgress(): Promise<Result<ObjectiveProgress[]>> {
  const { data, error } = await client().rpc('my_objectives_progress');
  if (error) return { data: null, error: 'Não foi possível carregar os objetivos.' };
  return {
    data: ((data ?? []) as ObjectiveProgress[]).map((o) => ({ ...o, logs: Number(o.logs) })),
    error: null,
  };
}

/** Declara o objetivo conquistado: o banco confere os registros e concede título e Cristais. */
export async function completeObjective(
  id: string,
): Promise<Result<{ title: string; titleNew: boolean; crystals: number }>> {
  const { data, error } = await client().rpc('complete_objective', { p_objective_id: id });
  if (error) {
    if (error.code === 'PR006') return { data: null, error: error.message };
    if (error.code === '22023') return { data: null, error: 'Este objetivo já foi conquistado.' };
    return { data: null, error: 'Não foi possível concluir. Verifique a internet e tente de novo.' };
  }
  const r = data as { title: string; title_new: boolean; coins_awarded: number };
  return { data: { title: r.title, titleNew: r.title_new, crystals: Number(r.coins_awarded) }, error: null };
}
