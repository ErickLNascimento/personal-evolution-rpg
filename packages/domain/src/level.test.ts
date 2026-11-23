import { levelFromXp, xpCostOfLevel, xpToReachLevel } from './level';

describe('níveis', () => {
  it('segue a fórmula 50 × n × (n − 1)', () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(xpToReachLevel(2)).toBe(100);
    expect(xpToReachLevel(3)).toBe(300);
    expect(xpToReachLevel(10)).toBe(4500);
    expect(xpCostOfLevel(10)).toBe(1000);
  });

  it('começa no nível 1 com 0 XP', () => {
    expect(levelFromXp(0)).toEqual({
      level: 1,
      totalXp: 0,
      xpIntoLevel: 0,
      xpToNextLevel: 100,
      progress: 0,
    });
  });

  it('sobe exatamente no limite', () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(299).level).toBe(2);
    expect(levelFromXp(300).level).toBe(3);
  });

  it('calcula a barra de progresso', () => {
    const p = levelFromXp(350);
    expect(p.level).toBe(3);
    expect(p.xpIntoLevel).toBe(50);
    expect(p.xpToNextLevel).toBe(250);
    expect(p.progress).toBeCloseTo(50 / 300);
  });

  it('é consistente em todos os limites até o nível 500', () => {
    for (let n = 1; n <= 500; n++) {
      expect(levelFromXp(xpToReachLevel(n)).level).toBe(n);
      if (n > 1) expect(levelFromXp(xpToReachLevel(n) - 1).level).toBe(n - 1);
    }
  });

  it('trata XP negativo como zero', () => {
    expect(levelFromXp(-50).level).toBe(1);
    expect(() => xpToReachLevel(0)).toThrow();
  });
});
