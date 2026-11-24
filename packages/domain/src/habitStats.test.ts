import { habitDayStatus, habitHeatmap, habitStats, RECENT_DAYS } from './habitStats';
import { addDays } from './dates';
import type { Habit } from './schedule';

// 2026-11-16 é segunda-feira.
const treino: Habit = {
  id: 'treino',
  title: 'Treinar',
  difficulty: 'hard',
  scheduleDays: [1, 2, 3, 4, 5], // segunda a sexta
  startDate: '2026-11-16',
};

const set = (...dates: string[]) => new Set(dates);

describe('situação de cada dia', () => {
  const today = '2026-11-25'; // quarta
  const logged = set('2026-11-16');

  it('separa feito, perdido, em aberto, fora da agenda e fora do período', () => {
    expect(habitDayStatus(treino, logged, '2026-11-16', today)).toBe('done');
    expect(habitDayStatus(treino, logged, '2026-11-17', today)).toBe('missed');
    expect(habitDayStatus(treino, logged, '2026-11-22', today)).toBe('off'); // domingo
    expect(habitDayStatus(treino, logged, '2026-11-24', today)).toBe('open'); // ontem
    expect(habitDayStatus(treino, logged, today, today)).toBe('open');
    expect(habitDayStatus(treino, logged, '2026-11-26', today)).toBe('outside'); // amanhã
    expect(habitDayStatus(treino, logged, '2026-11-15', today)).toBe('outside'); // antes do início
  });

  it('dias depois do arquivamento ficam fora', () => {
    const arquivado = { ...treino, archivedOn: '2026-11-18' };
    expect(habitDayStatus(arquivado, logged, '2026-11-19', today)).toBe('outside');
  });
});

describe('estatísticas do hábito', () => {
  it('sem histórico não tem taxa', () => {
    const s = habitStats(treino, set(), '2026-11-16');
    expect(s).toEqual({ scheduled: 0, done: 0, rate: null, recentRate: null, currentStreak: 0, bestStreak: 0 });
  });

  it('hoje e ontem sem registro não contam contra a taxa nem quebram a sequência', () => {
    const s = habitStats(treino, set('2026-11-16', '2026-11-17', '2026-11-18'), '2026-11-20');
    expect(s.scheduled).toBe(3);
    expect(s.rate).toBe(1);
    expect(s.currentStreak).toBe(3);
  });

  it('dias em aberto já feitos entram na conta', () => {
    const s = habitStats(treino, set('2026-11-19', '2026-11-20'), '2026-11-20');
    expect(s.scheduled).toBe(5);
    expect(s.done).toBe(2);
    expect(s.rate).toBeCloseTo(0.4);
  });

  it('o fim de semana fora da agenda não quebra a sequência', () => {
    // sexta e segunda feitas, sábado e domingo fora da agenda
    const s = habitStats(treino, set('2026-11-20', '2026-11-23'), '2026-11-23');
    expect(s.currentStreak).toBe(2);
  });

  it('guarda a melhor sequência depois de uma falta', () => {
    const logged = set('2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-23');
    const s = habitStats(treino, logged, '2026-11-25');
    expect(s.bestStreak).toBe(4);
    expect(s.currentStreak).toBe(1); // a sexta 20 foi perdida
    expect(s.scheduled).toBe(6);
    expect(s.done).toBe(5);
  });

  it('a taxa recente olha só os últimos dias', () => {
    const today = addDays('2026-11-16', 70);
    const old = Array.from({ length: 30 }, (_, i) => addDays('2026-11-16', i));
    const s = habitStats({ ...treino, scheduleDays: [0, 1, 2, 3, 4, 5, 6] }, set(...old), today);
    expect(s.rate).toBeGreaterThan(0);
    expect(s.recentRate).toBe(0);
    expect(RECENT_DAYS).toBe(30);
  });

  it('hábito arquivado para de contar no arquivamento', () => {
    const arquivado = { ...treino, archivedOn: '2026-11-18' };
    const s = habitStats(arquivado, set('2026-11-16', '2026-11-17', '2026-11-18'), '2026-12-10');
    expect(s).toMatchObject({ scheduled: 3, done: 3, rate: 1, bestStreak: 3 });
  });
});

describe('mapa de calor', () => {
  it('termina na semana de hoje, de segunda a domingo', () => {
    const weeks = habitHeatmap(treino, set('2026-11-16'), '2026-11-25', 3);
    expect(weeks.map((w) => w.start)).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(weeks[1]!.days.map((d) => d.status)).toEqual(['done', 'missed', 'missed', 'missed', 'missed', 'off', 'off']);
    expect(weeks[2]!.days.map((d) => d.status)).toEqual(['missed', 'open', 'open', 'outside', 'outside', 'outside', 'outside']);
    expect(weeks[0]!.days.every((d) => d.status === 'outside')).toBe(true);
  });
});
