import type { PostgrestError } from '@supabase/supabase-js';
import { addDays, ambusher, parseAmbush, type Ambush, type LocalDate } from '@per/domain';
import type { Result } from '@/features/habits/api';
import { t } from '@/i18n';
import { isDevKeyOn } from '@/lib/featureSnapshot';
import { supabase } from '@/lib/supabase';

/**
 * Só no build de desenvolvimento (EXPO_PUBLIC_DEV_FEATURES=dev_ambush_preview): sem emboscada
 * sorteada, mostra uma de mentira (ontem e hoje) para ver o cartão. O resgate dela falha no banco.
 */
function devPreview(): Ambush | null {
  if (!isDevKeyOn('dev_ambush_preview')) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    ambusher: ambusher('goblin')!,
    startDate: addDays(today, -1),
    endDate: today,
    claimed: false,
    preview: true,
  };
}

/** Emboscada que importa hoje (em andamento, de resgate ou a próxima da semana); null = nenhuma. */
export async function fetchAmbush(): Promise<Result<Ambush | null>> {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase.rpc('my_ambush');
  // Banco sem a migration (função ausente): sem emboscada, sem erro na tela.
  if (error) return { data: devPreview(), error: null };
  return { data: parseAmbush(data) ?? devPreview(), error: null };
}

function failure(error: PostgrestError): { data: null; error: string } {
  if (error.code === 'PR040') return { data: null, error: t('ambush.errorNotDone') };
  if (error.code === '22023') return { data: null, error: t('ambush.errorLate') };
  if (error.code === 'P0002') return { data: null, error: t('ambush.errorGone') };
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
  return { data: null, error: t('ambush.errorClaim') };
}

export async function claimAmbush(start: LocalDate): Promise<Result<{ coins: number }>> {
  if (!supabase) return { data: null, error: t('ambush.errorClaim') };
  const { data, error } = await supabase.rpc('claim_ambush', { p_start: start });
  if (error) return failure(error);
  return { data: { coins: Number((data as { coins_awarded: number }).coins_awarded) }, error: null };
}
