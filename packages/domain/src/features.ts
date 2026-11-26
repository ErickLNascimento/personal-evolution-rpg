/**
 * Feature flags: linhas `feature_<nome>` na tabela app_settings do Supabase (1 liga, 0 desliga).
 * A equipe liga e desliga pelo SQL Editor ou pelo Table Editor; o app lê ao abrir.
 *   update public.app_settings set value = 1 where key = 'feature_mood_journal';
 * Flag ausente = desligada.
 */
export const FEATURES = {
  /** Diário de humor (check-in na tela Hoje e cartão em Progresso). */
  moodJournal: 'feature_mood_journal',
  /** Exportação dos dados pessoais (LGPD), no Perfil. */
  dataExport: 'feature_data_export',
  /** App em inglês (seletor de idioma no Perfil); desligado, tudo em português. */
  english: 'feature_english',
  /** Modo férias: pausar dias sem perder o streak (Perfil e tela Hoje). */
  vacation: 'feature_vacation',
  /** Pop-up que pede uma nota de 1 a 5 depois de momentos bons. */
  feedbackPrompt: 'feature_feedback_prompt',
  /** Cartão "Resumo da semana" na tela Hoje, de segunda a quarta. */
  weeklyRecap: 'feature_weekly_recap',
  /** Patentes dos chefes: cada vitória faz o chefe voltar mais forte. */
  bossRanks: 'feature_boss_ranks',
  /** Bestiário no Progresso: a coleção de chefes vencidos. */
  bestiary: 'feature_bestiary',
  /** Fraquezas: cada chefe leva golpe dobrado das missões de uma área da vida. */
  bossWeakness: 'feature_boss_weakness',
  /** Emboscadas: minichefes surpresa de 2 dias com um desafio curto. */
  ambush: 'feature_ambush',
  /** Ato II: seis chefes novos no rodízio, a partir de boss_act2_start_week. */
  act2: 'feature_act_2',
  /** Lorde do mês: um chefe lendário que dura o mês inteiro. */
  monthlyBoss: 'feature_monthly_boss',
  /** Aviso de convite de amizade: ponto na Fogueira e cartão na tela Hoje. */
  friendAlerts: 'feature_friend_alerts',
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
