import { FunctionsHttpError } from '@supabase/supabase-js';
import { parseAiPlan, type AiPlanContent, type AiPlanKind, type AiPlanStatus } from '@per/domain';
import type { Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

export interface AiPlan extends AiPlanContent {
  id: string;
  kind: AiPlanKind;
  status: AiPlanStatus;
  createdAt: string;
}

interface PlanRow {
  id: string;
  kind: AiPlanKind;
  status: AiPlanStatus;
  payload: unknown;
  created_at: string;
}

function fromRow(row: PlanRow): AiPlan {
  return { id: row.id, kind: row.kind, status: row.status, createdAt: row.created_at, ...parseAiPlan(row.payload) };
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

/** Plano mais recente (de qualquer tipo), para mostrar o que está pendente. */
export async function latestPlan(): Promise<Result<AiPlan | null>> {
  const { data, error } = await client()
    .from('ai_plans')
    .select('id, kind, status, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PlanRow>();
  if (error) return { data: null, error: 'Não foi possível carregar as sugestões.' };
  return { data: data ? fromRow(data) : null, error: null };
}

/** Pede um plano à Edge Function ai-plan. Pode levar alguns segundos. */
export async function requestPlan(kind: AiPlanKind): Promise<Result<AiPlan>> {
  const { data, error } = await client().functions.invoke<{ plan: PlanRow }>('ai-plan', { body: { kind } });
  if (error) {
    // A função devolve { error: "mensagem em português" } com o status HTTP.
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (body && typeof body.error === 'string') return { data: null, error: body.error };
    }
    return { data: null, error: 'Não foi possível falar com a IA. Verifique a internet e tente de novo.' };
  }
  if (!data?.plan) return { data: null, error: 'A IA não devolveu um plano.' };
  return { data: fromRow(data.plan), error: null };
}

/** Aceita as sugestões escolhidas (criando os hábitos) ou recusa o plano. */
export async function decidePlan(
  planId: string,
  accept: boolean,
  indexes: number[] = [],
): Promise<Result<{ habitsCreated: number }>> {
  const { data, error } = await client().rpc('decide_ai_plan', {
    p_plan_id: planId,
    p_accept: accept,
    p_items: indexes,
  });
  if (error) {
    if (error.code === '22023') return { data: null, error: 'Este plano já foi decidido ou mudou. Atualize a tela.' };
    return { data: null, error: 'Não foi possível salvar a decisão. Tente de novo.' };
  }
  return { data: { habitsCreated: Number((data as { habits_created: number }).habits_created) }, error: null };
}
