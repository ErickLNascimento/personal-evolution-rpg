/**
 * Feature flags: linhas `feature_<nome>` na tabela app_settings do Supabase (1 liga, 0 desliga).
 * A equipe liga e desliga pelo SQL Editor ou pelo Table Editor; o app lê ao abrir.
 *   update public.app_settings set value = 1 where key = 'feature_mood_journal';
 * Flag ausente = desligada.
 */
export const FEATURES = {
  /** Diário de humor (check-in na tela Hoje e cartão em Progresso). */
  moodJournal: 'feature_mood_journal',
  // Recursos anteriores à regra das flags (ligados por padrão; ver LEGACY_FEATURES).
  shop: 'feature_shop',
  challenges: 'feature_challenges',
  social: 'feature_social',
  habitKinds: 'feature_habit_kinds',
  habitStats: 'feature_habit_stats',
  flashMission: 'feature_flash_mission',
  streakShields: 'feature_streak_shields',
  oracle: 'feature_oracle',
  smartNotifications: 'feature_smart_notifications',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/**
 * Recursos que já existiam antes das flags: ficam ligados se a linha não existir (só 0 desliga),
 * para nada sumir dos testers se o app chegar antes da migration. Os novos exigem 1.
 */
export const LEGACY_FEATURES: ReadonlySet<string> = new Set([
  FEATURES.shop,
  FEATURES.challenges,
  FEATURES.social,
  FEATURES.habitKinds,
  FEATURES.habitStats,
  FEATURES.flashMission,
  FEATURES.streakShields,
  FEATURES.oracle,
  FEATURES.smartNotifications,
]);

/** Flags ligadas, a partir das linhas de app_settings. */
export function enabledFeatures(rows: readonly { key: string; value: number }[]): Set<string> {
  const value = new Map(
    rows.filter((r) => r.key.startsWith('feature_')).map((r) => [r.key, Number(r.value)]),
  );
  const on = new Set([...value].filter(([, v]) => v === 1).map(([k]) => k));
  for (const k of LEGACY_FEATURES) if (!value.has(k)) on.add(k);
  return on;
}
