import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  parseAiPlan,
  type AiPlanContent,
  type AiPlanKind,
  type AiPlanStatus,
  type PlanRequest,
  type SuggestionEdit,
} from '@per/domain';
import type { Result } from '@/features/habits/api';
import { currentLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** Trocas de sugestão permitidas por plano (mesmo valor do banco). */
export const MAX_SWAPS = 3;

export interface AiPlan extends AiPlanContent {
  id: string;
  kind: AiPlanKind;
  status: AiPlanStatus;
  createdAt: string;
  swaps: number;
}

interface PlanRow {
  id: string;
  kind: AiPlanKind;
  status: AiPlanStatus;
  payload: unknown;
  created_at: string;
  swaps?: number;
}

function fromRow(row: PlanRow): AiPlan {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdAt: row.created_at,
    swaps: Number(row.swaps ?? 0),
    ...parseAiPlan(row.payload),
  };
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

/** Plano mais recente (de qualquer tipo), para mostrar o que está pendente. */
export async function latestPlan(): Promise<Result<AiPlan | null>> {
  const { data, error } = await client()
    .from('ai_plans')
    .select('id, kind, status, payload, created_at, swaps')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PlanRow>();
  if (error) return { data: null, error: t('apiErrors.loadPlan') };
  return { data: data ? fromRow(data) : null, error: null };
}

async function invokeAiPlan(body: Record<string, unknown>): Promise<Result<AiPlan>> {
  const { data, error } = await client().functions.invoke<{ plan: PlanRow }>('ai-plan', {
    body: { ...body, locale: currentLocale() },
  });
  if (error) {
    // A função devolve { error: "mensagem" } no idioma pedido, com o status HTTP.
    if (error instanceof FunctionsHttpError) {
      const res = await (error.context as Response).json().catch(() => null);
      if (res && typeof res.error === 'string') return { data: null, error: res.error };
    }
    return { data: null, error: t('apiErrors.aiUnreachable') };
  }
  if (!data?.plan) return { data: null, error: t('apiErrors.aiNoPlan') };
  return { data: fromRow(data.plan), error: null };
}

/** Pede um plano à Edge Function ai-plan, com o que a pessoa contou no formulário. */
export function requestPlan(kind: AiPlanKind, request?: PlanRequest): Promise<Result<AiPlan>> {
  return invokeAiPlan({ kind, request });
}

/** "Trocar esta": a IA substitui só uma sugestão do plano (até 3 por plano; não gasta o limite diário). */
export function swapSuggestion(planId: string, index: number): Promise<Result<AiPlan>> {
  return invokeAiPlan({ kind: 'swap', plan_id: planId, index });
}

/** Aceita as sugestões escolhidas (com os ajustes feitos) ou recusa o plano. */
export async function decidePlan(
  planId: string,
  accept: boolean,
  indexes: number[] = [],
  edits: SuggestionEdit[] = [],
): Promise<Result<{ habitsCreated: number }>> {
  const { data, error } = await client().rpc('decide_ai_plan', {
    p_plan_id: planId,
    p_accept: accept,
    p_items: indexes,
    p_edits: edits,
  });
  if (error) {
    if (error.code === '22023') return { data: null, error: t('apiErrors.planChanged') };
    if (error.code === '23514') return { data: null, error: t('apiErrors.planInvalidEdit') };
    return { data: null, error: t('apiErrors.planDecide') };
  }
  return { data: { habitsCreated: Number((data as { habits_created: number }).habits_created) }, error: null };
}
