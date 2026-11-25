import { enabledFeatures, type FeatureKey } from '@per/domain';

/**
 * Retrato das feature flags para código fora do React (lembretes, escudos automáticos,
 * missão relâmpago). O ProfileProvider atualiza a cada leitura do perfil. Até lá, vale o
 * padrão de enabledFeatures sem linhas: recursos antigos ligados, novos desligados.
 */
let current: ReadonlySet<string> = enabledFeatures([]);

export function setFeatureSnapshot(features: ReadonlySet<string>) {
  current = features;
}

export function isFeatureOn(key: FeatureKey): boolean {
  return current.has(key);
}
