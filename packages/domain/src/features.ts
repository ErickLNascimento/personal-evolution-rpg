/**
 * Feature flags: linhas `feature_<nome>` na tabela app_settings do Supabase (1 liga, 0 desliga).
 * A equipe liga e desliga pelo SQL Editor ou pelo Table Editor; o app lê ao abrir.
 *   update public.app_settings set value = 1 where key = 'feature_mood_journal';
 * Flag ausente = desligada.
 */
export const FEATURES = {
  /** Diário de humor (check-in na tela Hoje e cartão em Progresso). */
  moodJournal: 'feature_mood_journal',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

/** Flags ligadas, a partir das linhas de app_settings. */
export function enabledFeatures(rows: readonly { key: string; value: number }[]): Set<string> {
  return new Set(
    rows.filter((r) => r.key.startsWith('feature_') && Number(r.value) === 1).map((r) => r.key),
  );
}
