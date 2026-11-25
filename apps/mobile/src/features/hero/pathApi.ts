import { isPathId, PATH_CHANGE_COOLDOWN_DAYS, type Branch, type PathId, type Tier, FEATURES } from '@per/domain';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Result } from '@/features/habits/api';
import { isFeatureOn } from '@/lib/featureSnapshot';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

/** Estado do caminho como o banco calcula (`my_hero_path`). */
export interface HeroPathInfo {
  path: PathId | null;
  branch: Branch | null;
  stage: Tier;
  level: number;
  /** Missões concluídas nas áreas do caminho. */
  areaMissions: number;
  next: { tier: Tier; minLevel: number; minMissions: number } | null;
  canPromote: boolean;
  needsBranch: boolean;
  /** Quando a próxima troca de caminho ou ramo fica liberada (null = liberada). */
  changeAvailableAt: Date | null;
}

interface HeroPathRow {
  path: string | null;
  branch: string | null;
  stage: number;
  level: number;
  area_missions: number;
  next_tier: { tier: number; min_level: number; min_missions: number } | null;
  can_promote: boolean;
  needs_branch: boolean | null;
  change_available_at: string | null;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

const asBranch = (b: string | null | undefined): Branch | null =>
  b === 'A' || b === 'B' ? b : null;

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  switch (error.code) {
    case 'PR011':
      return {
        data: null,
        error: t('apiErrors.pathCooldown', { days: PATH_CHANGE_COOLDOWN_DAYS }),
      };
    case 'PR013':
      return { data: null, error: t('promotion.maxed') };
    case 'PR014':
      return { data: null, error: t('apiErrors.promotionMissing') };
    case 'PR015':
      return { data: null, error: t('apiErrors.chooseBranch') };
    case 'PR016':
      return { data: null, error: t('promotion.noPath') };
  }
  if (/network|fetch/i.test(error.message))
    return { data: null, error: t('common.noConnection') };
  return { data: null, error: fallback };
}

export async function fetchHeroPath(): Promise<Result<HeroPathInfo>> {
  const { data, error } = await client().rpc('my_hero_path');
  if (error) return failure(error, t('apiErrors.loadPath'));
  const r = data as HeroPathRow;
  return {
    data: {
      path: isPathId(r.path) ? r.path : null,
      branch: asBranch(r.branch),
      stage: r.stage as Tier,
      level: r.level,
      areaMissions: r.area_missions,
      next: r.next_tier
        ? {
            tier: r.next_tier.tier as Tier,
            minLevel: r.next_tier.min_level,
            minMissions: r.next_tier.min_missions,
          }
        : null,
      canPromote: r.can_promote,
      needsBranch: Boolean(r.needs_branch),
      changeAvailableAt: r.change_available_at ? new Date(r.change_available_at) : null,
    },
    error: null,
  };
}

/** Primeira escolha ou troca de caminho (e/ou de ramo). */
export async function choosePath(
  path: PathId,
  branch: Branch | null = null,
): Promise<Result<{ stage: Tier; changed: boolean }>> {
  const { data, error } = await client().rpc('choose_path', { p_path: path, p_branch: branch });
  if (error) return failure(error, t('apiErrors.choosePath'));
  const r = data as { stage: number; changed: boolean };
  return { data: { stage: r.stage as Tier, changed: r.changed }, error: null };
}

/** Promove ao próximo estágio (o banco confere os requisitos). */
export async function promoteHero(
  branch: Branch | null = null,
): Promise<Result<{ stage: Tier; branch: Branch | null }>> {
  const { data, error } = await client().rpc('promote_hero', { p_branch: branch });
  if (error) return failure(error, t('apiErrors.promote'));
  const r = data as { stage: number; branch: string | null };
  return { data: { stage: r.stage as Tier, branch: asBranch(r.branch) }, error: null };
}

export interface FlashMission {
  habitId: string;
  deadline: Date;
  done: boolean;
  /** O bônus foi concedido (concluída no prazo e não desfeita). */
  awarded: boolean;
}

/** Missão relâmpago de hoje (o banco sorteia na primeira chamada do dia); null se não houver. */
export async function fetchFlashMission(): Promise<Result<FlashMission | null>> {
  if (!isFeatureOn(FEATURES.flashMission)) return { data: null, error: null };
  const { data, error } = await client().rpc('my_flash_mission');
  if (error) return failure(error, t('apiErrors.loadFlash'));
  if (!data) return { data: null, error: null };
  const r = data as { habit_id: string; deadline: string; done: boolean; awarded: boolean };
  return {
    data: {
      habitId: r.habit_id,
      deadline: new Date(r.deadline),
      done: r.done,
      awarded: Boolean(r.awarded),
    },
    error: null,
  };
}
