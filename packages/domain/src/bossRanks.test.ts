import {
  bestiary,
  bestiaryProgress,
  bossRank,
  bossTitle,
  DEFAULT_BOSS_RANK_RULES,
  parseRankRules,
  rankLabel,
  rankRule,
  type BossVictory,
} from './bossRanks';
import { BOSSES, BOSS_WEAKNESS, bossForWeek, missionDamage, weeklyBoss } from './challenges';
import type { Habit } from './schedule';

const golem = BOSSES.find((b) => b.id === 'golem')!;
const v = (weekStart: string, bossId: string, rank: 0 | 1 | 2 | 3): BossVictory => ({ weekStart, bossId, rank });

describe('patente do chefe', () => {
  const wins = [v('2026-01-05', 'golem', 0), v('2026-02-16', 'golem', 1), v('2026-01-12', 'hidra', 0)];

  it('sobe uma patente por vitória anterior contra o mesmo chefe', () => {
    expect(bossRank([], 'golem', '2026-03-30')).toBe(0);
    expect(bossRank(wins, 'golem', '2026-01-05')).toBe(0); // a própria semana não conta
    expect(bossRank(wins, 'golem', '2026-02-16')).toBe(1);
    expect(bossRank(wins, 'golem', '2026-03-30')).toBe(2);
    expect(bossRank(wins, 'hidra', '2026-03-30')).toBe(1);
  });

  it('para no Lorde e volta a Soldado com a flag desligada', () => {
    const many = ['01-05', '02-16', '03-30', '05-11', '06-22'].map((d) => v(`2026-${d}`, 'golem', 0));
    expect(bossRank(many, 'golem', '2026-08-03')).toBe(3);
    expect(bossRank(many, 'golem', '2026-08-03', false)).toBe(0);
  });

  it('nome com a patente e regras', () => {
    expect(bossTitle(golem, 0)).toBe('Golem da Preguiça');
    expect(bossTitle(golem, 1)).toBe('Golem da Preguiça, Capitão');
    expect(bossTitle(golem, 3, 'en')).toBe('Golem of Sloth, Lord');
    expect(rankLabel(2, 'en')).toBe('General');
    expect(rankRule([], 2)).toEqual({ rank: 2, hpPct: 90, reward: 90 });
    const fromDb = parseRankRules([
      { rank: 1, hp_pct: 88, reward: 70 },
      { rank: 9, hp_pct: 50, reward: 1 },
      { rank: 2, hp_pct: 0, reward: 10 },
    ]);
    expect(fromDb).toEqual([{ rank: 1, hpPct: 88, reward: 70 }]);
    expect(rankRule(fromDb, 1).reward).toBe(70);
    expect(rankRule(fromDb, 3)).toEqual(DEFAULT_BOSS_RANK_RULES[3]);
  });
});

describe('vida pela patente', () => {
  const daily: Habit = { id: 'h', title: 'Ler', difficulty: 'easy', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-01-01' };
  it('mais vida em patentes altas', () => {
    const logged = new Map<string, Set<string>>();
    const soldier = weeklyBoss([daily, { ...daily, id: 'h2' }], logged, '2026-11-25', '2026-11-23');
    const lord = weeklyBoss([daily, { ...daily, id: 'h2' }], logged, '2026-11-25', '2026-11-23', 95);
    expect(soldier.maxHp).toBe(12); // 80% de 14, para cima
    expect(lord.maxHp).toBe(14); // 95% de 14 = 13,3 → 14
  });
});

describe('bestiário', () => {
  it('lista todos os chefes, com vitórias, maior patente e primeira vitória', () => {
    const entries = bestiary([v('2026-02-16', 'golem', 1), v('2026-01-05', 'golem', 0), v('2026-01-12', 'hidra', 0)]);
    expect(entries.map((e) => e.boss.id)).toEqual(BOSSES.map((b) => b.id));
    const g = entries.find((e) => e.boss.id === 'golem')!;
    expect(g).toMatchObject({ wins: 2, bestRank: 1, firstWin: '2026-01-05' });
    expect(entries.find((e) => e.boss.id === 'lich')).toMatchObject({ wins: 0, bestRank: null, firstWin: null });
    expect(bestiaryProgress(entries)).toEqual({ done: 3, total: 24 });
  });

  it('o rodízio do banco usa a mesma ordem', () => {
    // 2026-11-16 → Dragão, 2026-11-23 → Sombra (mesma conta de boss_for_week no SQL)
    expect(bossForWeek('2026-11-16').id).toBe('dragao');
    expect(bossForWeek('2026-11-23').id).toBe('sombra');
  });
});

describe('fraquezas', () => {
  it('missão da área fraca tira 2 de vida; sem área ou outra área, 1', () => {
    expect(BOSS_WEAKNESS.golem).toBe('health');
    expect(Object.keys(BOSS_WEAKNESS).sort()).toEqual(BOSSES.map((b) => b.id).sort());
    expect(missionDamage('health', 'health')).toBe(2);
    expect(missionDamage('career', 'health')).toBe(1);
    expect(missionDamage(null, 'health')).toBe(1);
    expect(missionDamage('health', null)).toBe(1);
  });

  it('o chefe cai mais cedo com missões da área fraca', () => {
    const run: Habit = { id: 'run', title: 'Correr', difficulty: 'easy', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-01-01', category: 'health' };
    const read: Habit = { ...run, id: 'read', title: 'Ler', category: 'knowledge' };
    const logged = new Map<string, Set<string>>(
      ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'].map((d) => [d, new Set(['run'])]),
    );
    const plain = weeklyBoss([run, read], logged, '2026-11-26', '2026-11-23');
    const weak = weeklyBoss([run, read], logged, '2026-11-26', '2026-11-23', 80, 'health');
    expect(plain.damage).toBe(4);
    expect(weak.damage).toBe(8);
    expect(weak.maxHp).toBe(12); // a vida não muda
    expect(weak.defeated).toBe(false);
  });
});
