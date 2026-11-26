import { weekNumber } from './challenges';
import {
  monthEnd,
  monthlyBoss,
  monthlyBossFor,
  monthlyClaimOpen,
  monthNumber,
  monthStart,
  previousMonthStart,
} from './monthlyBoss';
import type { Habit } from './schedule';

const daily: Habit = { id: 'h', title: 'Ler', difficulty: 'easy', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-01-01' };

describe('mês', () => {
  it('início, fim, mês anterior e número', () => {
    expect(monthStart('2026-11-25')).toBe('2026-11-01');
    expect(monthEnd('2026-11-01')).toBe('2026-11-30');
    expect(monthEnd('2026-12-01')).toBe('2026-12-31');
    expect(monthEnd('2028-02-01')).toBe('2028-02-29');
    expect(previousMonthStart('2026-01-01')).toBe('2025-12-01');
    expect(monthNumber('1970-01-01')).toBe(0);
    expect(monthNumber('2026-11-01') - monthNumber('2026-10-01')).toBe(1);
  });
});

describe('Lorde do mês', () => {
  it('gira pelo Ato I e, com o Ato II no rodízio, pelos 12', () => {
    const a = monthlyBossFor('2026-11-01', 0).id;
    const b = monthlyBossFor('2026-12-01', 0).id;
    expect(a).not.toBe(b);
    const start = weekNumber('2026-11-30');
    expect(monthlyBossFor('2027-07-01', start).id).toBe('kraken'); // índice 6 dos 12: o 1º do Ato II
    expect(monthlyBossFor('2027-07-01', 0).id).toBe('golem');
  });

  it('vida de 70% das missões do mês; cada missão tira 1', () => {
    const logged = new Map<string, Set<string>>();
    for (let d = 1; d <= 21; d++) logged.set(`2026-11-${String(d).padStart(2, '0')}`, new Set(['h']));
    const m = monthlyBoss([daily], logged, '2026-11-01');
    expect(m.maxHp).toBe(21); // 70% de 30
    expect(m.damage).toBe(21);
    expect(m.defeated).toBe(true);
    logged.delete('2026-11-21');
    expect(monthlyBoss([daily], logged, '2026-11-01').defeated).toBe(false);
  });

  it('resgate até o dia 7 do mês seguinte', () => {
    expect(monthlyClaimOpen('2026-11-01', '2026-11-25')).toBe(true);
    expect(monthlyClaimOpen('2026-11-01', '2026-12-07')).toBe(true);
    expect(monthlyClaimOpen('2026-11-01', '2026-12-08')).toBe(false);
    expect(monthlyClaimOpen('2026-12-01', '2026-11-30')).toBe(false);
  });
});
