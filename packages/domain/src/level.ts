/**
 * Fórmula de nível da Fase 1.
 * Passar do nível n para o n+1 custa 100 × n XP.
 * XP total para chegar ao nível n: 50 × n × (n − 1). Nível 1 começa em 0 XP.
 */
export const LEVEL_FORMULA_VERSION = 1;

export function xpToReachLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error(`Nível inválido: ${level}`);
  return 50 * level * (level - 1);
}

export function xpCostOfLevel(level: number): number {
  return xpToReachLevel(level + 1) - xpToReachLevel(level);
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  /** XP acumulado dentro do nível atual. */
  xpIntoLevel: number;
  /** XP que falta para o próximo nível. */
  xpToNextLevel: number;
  /** Fração de 0 a 1 para a barra de experiência. */
  progress: number;
}

export function levelFromXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.08 * xp)) / 2));
  // Corrige eventuais erros de ponto flutuante.
  while (xpToReachLevel(level + 1) <= xp) level += 1;
  while (level > 1 && xpToReachLevel(level) > xp) level -= 1;

  const start = xpToReachLevel(level);
  const cost = xpCostOfLevel(level);
  const xpIntoLevel = xp - start;
  return {
    level,
    totalXp: xp,
    xpIntoLevel,
    xpToNextLevel: cost - xpIntoLevel,
    progress: xpIntoLevel / cost,
  };
}
