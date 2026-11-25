import {
  bossForWeek,
  bossRank,
  DEFAULT_BOSS_RANK_RULES,
  FEATURES,
  parseRankRules,
  rankRule,
  type BossRank,
  type BossRankRule,
  type BossVictory,
  type LocalDate,
} from '@per/domain';
import { useCallback } from 'react';
import type { Result } from '@/features/habits/api';
import { useFeature } from '@/features/profile/useFeature';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { supabase } from '@/lib/supabase';

export interface BossProgress {
  victories: BossVictory[];
  rules: readonly BossRankRule[];
  /** Emboscadas vencidas (minichefe e dia em que começou). */
  ambushVictories: BossVictory[];
}

const EMPTY: BossProgress = { victories: [], rules: DEFAULT_BOSS_RANK_RULES, ambushVictories: [] };
/** Banco ainda sem a migration das patentes: tabela ausente. */
const MISSING = new Set(['PGRST205', '42P01']);

/** Vitórias contra chefes (RLS: só as próprias) e a tabela de patentes. */
export async function fetchBossProgress(): Promise<Result<BossProgress>> {
  if (!supabase) return { data: EMPTY, error: null };
  const [victories, rules, ambushes] = await Promise.all([
    supabase
      .from('boss_victories')
      .select('week_start, boss_id, rank')
      .order('week_start')
      .returns<{ week_start: string; boss_id: string; rank: number }[]>(),
    supabase
      .from('boss_ranks')
      .select('rank, hp_pct, reward')
      .returns<{ rank: number; hp_pct: number; reward: number }[]>(),
    supabase
      .from('ambush_victories')
      .select('start_date, ambusher')
      .order('start_date')
      .returns<{ start_date: string; ambusher: string }[]>(),
  ]);
  if (victories.error && !MISSING.has(victories.error.code)) return { data: EMPTY, error: null };
  const parsed = rules.data ? parseRankRules(rules.data) : [];
  return {
    data: {
      victories: (victories.data ?? []).map((v) => ({
        weekStart: v.week_start,
        bossId: v.boss_id,
        rank: Math.min(3, Math.max(0, v.rank)) as BossRank,
      })),
      rules: parsed.length ? parsed : DEFAULT_BOSS_RANK_RULES,
      ambushVictories: (ambushes.data ?? []).map((v) => ({
        weekStart: v.start_date,
        bossId: v.ambusher,
        rank: 0 as BossRank,
      })),
    },
    error: null,
  };
}

/** Patente e regra (vida e prêmio) do chefe de uma semana, para a pessoa. */
export function rankFor(
  progress: BossProgress | null,
  weekStart: LocalDate,
  enabled: boolean,
): { rank: BossRank; rule: BossRankRule } {
  const rank = bossRank(progress?.victories ?? [], bossForWeek(weekStart).id, weekStart, enabled);
  return { rank, rule: rankRule(progress?.rules ?? DEFAULT_BOSS_RANK_RULES, rank) };
}

/** Vitórias e patentes, recarregadas ao ganhar foco. */
export function useBossProgress() {
  const enabled = useFeature(FEATURES.bossRanks);
  const load = useCallback(() => fetchBossProgress(), []);
  const progress = useFocusLoad<BossProgress>(load);
  return { progress: progress.data, enabled, refresh: progress.refresh };
}
