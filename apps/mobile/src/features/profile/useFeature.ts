import type { FeatureKey } from '@per/domain';
import { useProfile } from './useProfile';

/**
 * A feature flag está ligada? Lida do Supabase (app_settings `feature_*` = 1) junto com o
 * perfil, ao abrir o app. Sem perfil carregado (ou flag ausente), desligada.
 */
export function useFeature(key: FeatureKey): boolean {
  const { profile } = useProfile();
  return profile?.features.has(key) ?? false;
}
