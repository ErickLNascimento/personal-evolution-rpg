import { DEFAULT_HERO, heroLook, isHeroUnset, levelFromXp, type HeroLook, type LevelProgress } from '@per/domain';
import { useCallback } from 'react';
import type { Result } from '@/features/habits/api';
import { useProfile } from '@/features/profile/ProfileProvider';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { t } from '@/i18n';

async function fetchTotalXp(): Promise<Result<number>> {
  if (!supabase) return { data: null, error: t('apiErrors.noSupabase') };
  const { data, error } = await supabase.rpc('my_total_xp');
  if (error) return { data: null, error: t('apiErrors.loadLevel') };
  return { data: Number(data ?? 0), error: null };
}

/** Herói do usuário: aparência salva (limitada ao que o nível permite), nível e XP. */
export function useHero() {
  const { profile, update } = useProfile();
  const load = useCallback(() => fetchTotalXp(), []);
  const xp = useFocusLoad<number>(load, Boolean(profile));
  const level: LevelProgress = levelFromXp(xp.data ?? 0);
  const hero: HeroLook = profile ? heroLook(profile.hero, level.level, profile.heroPath, profile.race, profile.cosmetics) : DEFAULT_HERO;

  return {
    hero,
    level,
    unset: isHeroUnset(profile?.hero),
    loading: xp.loading,
    error: xp.error,
    save: (look: HeroLook) => update({ hero: look }),
  };
}
