import type { PostgrestError } from '@supabase/supabase-js';
import { isObjectiveCategory, type DuoQuestState, type ObjectiveCategory } from '@per/domain';
import type { Result } from '@/features/habits/api';
import { toCard, type CardRow, type SocialCard } from '@/features/social/api';
import { t, type TKey } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** Missão em equipe vista por mim: o parceiro é sempre "o outro". */
export interface DuoQuest extends DuoQuestState {
  id: string;
  category: ObjectiveCategory | null;
  reward: number;
  partner: SocialCard;
}

const MESSAGES: Record<string, TKey> = {
  PR050: 'duo.errorOff',
  PR070: 'duo.errorNotFriends',
  PR071: 'duo.errorLimit',
  PR072: 'duo.errorPair',
  PR073: 'duo.errorNotDone',
  PR074: 'duo.errorLate',
  P0002: 'duo.errorGone',
};

function failure(error: PostgrestError, fallback: TKey): { data: null; error: string } {
  const known = error.code ? MESSAGES[error.code] : undefined;
  if (known) return { data: null, error: t(known) };
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
  return { data: null, error: t(fallback) };
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

interface DuoRow {
  id: string;
  week_start: string;
  category: string | null;
  target: number;
  status: 'pending' | 'active';
  i_invited: boolean;
  reward: number;
  partner: CardRow;
  my_done: number;
  partner_done: number;
  claimed: boolean;
}

export async function fetchDuoQuests(): Promise<Result<DuoQuest[]>> {
  const { data, error } = await client().rpc('my_duo_quests');
  if (error) return failure(error, 'duo.errorLoad');
  const rows = (data ?? []) as DuoRow[];
  return {
    data: rows.map((r) => ({
      id: r.id,
      weekStart: r.week_start,
      category: r.category && isObjectiveCategory(r.category) ? r.category : null,
      target: Number(r.target),
      status: r.status,
      iInvited: r.i_invited,
      reward: Number(r.reward),
      partner: toCard(r.partner),
      myDone: Number(r.my_done),
      partnerDone: Number(r.partner_done),
      claimed: r.claimed,
    })),
    error: null,
  };
}

export async function createDuoQuest(
  partner: string,
  category: ObjectiveCategory | null,
  target: number,
): Promise<Result<string>> {
  const { data, error } = await client().rpc('create_duo_quest', {
    p_partner: partner,
    p_category: category,
    p_target: target,
  });
  if (error) return failure(error, 'duo.errorCreate');
  return { data: (data as { id: string }).id, error: null };
}

export async function respondDuoQuest(id: string, accept: boolean): Promise<Result<true>> {
  const { error } = await client().rpc('respond_duo_quest', { p_id: id, p_accept: accept });
  if (error) return failure(error, 'duo.errorRespond');
  return { data: true, error: null };
}

export async function cancelDuoQuest(id: string): Promise<Result<true>> {
  const { error } = await client().rpc('cancel_duo_quest', { p_id: id });
  if (error) return failure(error, 'duo.errorRespond');
  return { data: true, error: null };
}

export async function claimDuoQuest(id: string): Promise<Result<{ coins: number }>> {
  const { data, error } = await client().rpc('claim_duo_quest', { p_id: id });
  if (error) return failure(error, 'duo.errorClaim');
  return { data: { coins: Number((data as { coins_awarded: number }).coins_awarded) }, error: null };
}
