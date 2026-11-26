/**
 * Patentes dos chefes (espelha 20261127000400_boss_ranks.sql; ver o documento de design
 * "Chefes a longo prazo"). O chefe da semana é o mesmo para todos; a patente é de cada pessoa:
 * cada vitória contra um chefe o faz voltar uma patente acima (Soldado → Capitão → General →
 * Lorde), com mais vida e mais Cristais. A vitória conta no resgate do prêmio.
 */
import { BOSSES, BOSS_PASS_PCT, BOSS_REWARD, bossText, type Boss } from './challenges';
import { compareLocalDates, type LocalDate } from './dates';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export const BOSS_RANKS = ['soldado', 'capitao', 'general', 'lorde'] as const;
export type BossRankId = (typeof BOSS_RANKS)[number];
/** Índice da patente: 0 = Soldado … 3 = Lorde. */
export type BossRank = 0 | 1 | 2 | 3;
export const MAX_BOSS_RANK: BossRank = 3;

export interface BossRankRule {
  rank: BossRank;
  /** Vida = esta porcentagem das missões agendadas na semana. */
  hpPct: number;
  /** Cristais do resgate. */
  reward: number;
}

/** Padrão (o banco guarda a tabela `boss_ranks`, que a equipe ajusta). */
export const DEFAULT_BOSS_RANK_RULES: readonly BossRankRule[] = [
  { rank: 0, hpPct: BOSS_PASS_PCT, reward: BOSS_REWARD },
  { rank: 1, hpPct: 85, reward: 60 },
  { rank: 2, hpPct: 90, reward: 90 },
  { rank: 3, hpPct: 95, reward: 130 },
];

const RANK_LABEL: Record<Locale, readonly string[]> = {
  'pt-BR': ['Soldado', 'Capitão', 'General', 'Lorde'],
  en: ['Soldier', 'Captain', 'General', 'Lord'],
};

export function rankLabel(rank: BossRank, locale: Locale = DEFAULT_LOCALE): string {
  return RANK_LABEL[locale][rank]!;
}

/** "Golem da Preguiça" (Soldado) ou "Golem da Preguiça, Capitão". */
export function bossTitle(boss: Boss, rank: BossRank, locale: Locale = DEFAULT_LOCALE): string {
  const name = bossText(boss, locale).name;
  return rank === 0 ? name : `${name}, ${rankLabel(rank, locale)}`;
}

export interface BossVictory {
  weekStart: LocalDate;
  bossId: string;
  /** Patente vencida naquela semana. */
  rank: BossRank;
}

/**
 * Patente do chefe numa semana: vitórias anteriores contra ele, até Lorde. Com a flag
 * desligada (`enabled` falso), todos são Soldado, como antes das patentes.
 */
export function bossRank(
  victories: readonly BossVictory[],
  bossId: string,
  weekStart: LocalDate,
  enabled = true,
): BossRank {
  if (!enabled) return 0;
  const before = victories.filter(
    (v) => v.bossId === bossId && compareLocalDates(v.weekStart, weekStart) < 0,
  ).length;
  return Math.min(before, MAX_BOSS_RANK) as BossRank;
}

/** Regra da patente (tabela do banco, com o padrão onde faltar). */
export function rankRule(rules: readonly BossRankRule[], rank: BossRank): BossRankRule {
  return rules.find((r) => r.rank === rank) ?? DEFAULT_BOSS_RANK_RULES[rank]!;
}

/** Lê as linhas de `boss_ranks`; inválidas ficam de fora (o padrão cobre). */
export function parseRankRules(
  rows: readonly { rank: number; hp_pct: number; reward: number }[],
): BossRankRule[] {
  return rows
    .filter((r) => Number.isInteger(r.rank) && r.rank >= 0 && r.rank <= MAX_BOSS_RANK)
    .filter((r) => r.hp_pct > 0 && r.hp_pct <= 100 && r.reward >= 0)
    .map((r) => ({ rank: r.rank as BossRank, hpPct: r.hp_pct, reward: r.reward }));
}

export interface BestiaryEntry {
  boss: Boss;
  /** Vezes que venceu este chefe. */
  wins: number;
  /** Maior patente vencida (null = nunca venceu). */
  bestRank: BossRank | null;
  firstWin: LocalDate | null;
}

/** Bestiário: todos os chefes, na ordem do rodízio, com as vitórias de cada um. */
export function bestiary(
  victories: readonly BossVictory[],
  bosses: readonly Boss[] = BOSSES,
): BestiaryEntry[] {
  return bosses.map((boss) => {
    const mine = victories
      .filter((v) => v.bossId === boss.id)
      .sort((a, b) => compareLocalDates(a.weekStart, b.weekStart));
    return {
      boss,
      wins: mine.length,
      bestRank: mine.length ? (Math.max(...mine.map((v) => v.rank)) as BossRank) : null,
      firstWin: mine[0]?.weekStart ?? null,
    };
  });
}

/** Vitórias possíveis no bestiário (chefes × patentes) e quantas já foram feitas. */
export function bestiaryProgress(entries: readonly BestiaryEntry[]): { done: number; total: number } {
  return {
    done: entries.reduce((sum, e) => sum + (e.bestRank === null ? 0 : e.bestRank + 1), 0),
    total: entries.length * (MAX_BOSS_RANK + 1),
  };
}
