import { computeStreak, type DayStatus } from './streak';

const days = (entries: Record<string, DayStatus>) => new Map(Object.entries(entries));

describe('streak', () => {
  it('conta dias completos seguidos', () => {
    const s = computeStreak(
      days({ '2026-11-18': 'complete', '2026-11-19': 'complete', '2026-11-20': 'complete' }),
      '2026-11-20',
      '2026-11-18',
    );
    expect(s).toEqual({ current: 3, restDaysUsed: 0 });
  });

  it('hoje incompleto não quebra', () => {
    const s = computeStreak(
      days({ '2026-11-19': 'complete', '2026-11-20': 'missed' }),
      '2026-11-20',
      '2026-11-19',
    );
    expect(s.current).toBe(1);
  });

  it('dia sem missão agendada não conta nem quebra', () => {
    const s = computeStreak(
      days({ '2026-11-20': 'complete', '2026-11-21': 'none', '2026-11-22': 'none', '2026-11-23': 'complete' }),
      '2026-11-23',
      '2026-11-20',
    );
    expect(s.current).toBe(2);
  });

  it('perdoa uma falta por semana', () => {
    // semana de 16 a 22/11: uma falta na quarta
    const s = computeStreak(
      days({
        '2026-11-17': 'complete',
        '2026-11-18': 'missed',
        '2026-11-19': 'complete',
        '2026-11-20': 'complete',
      }),
      '2026-11-20',
      '2026-11-17',
    );
    expect(s).toEqual({ current: 3, restDaysUsed: 1 });
  });

  it('a segunda falta na mesma semana quebra a sequência', () => {
    const s = computeStreak(
      days({
        '2026-11-17': 'complete',
        '2026-11-18': 'missed',
        '2026-11-19': 'missed',
        '2026-11-20': 'complete',
      }),
      '2026-11-20',
      '2026-11-17',
    );
    expect(s).toEqual({ current: 1, restDaysUsed: 1 });
  });

  it('faltas em semanas diferentes são perdoadas separadamente', () => {
    const s = computeStreak(
      days({
        '2026-11-14': 'complete',
        '2026-11-15': 'missed', // domingo, semana anterior
        '2026-11-16': 'missed', // segunda, semana nova
        '2026-11-17': 'complete',
      }),
      '2026-11-17',
      '2026-11-14',
    );
    expect(s).toEqual({ current: 2, restDaysUsed: 2 });
  });

  it('sem perdão quando restDaysPerWeek = 0', () => {
    const s = computeStreak(
      days({ '2026-11-18': 'complete', '2026-11-19': 'missed', '2026-11-20': 'complete' }),
      '2026-11-20',
      '2026-11-18',
      { restDaysPerWeek: 0 },
    );
    expect(s.current).toBe(1);
  });

  it('dia sem registro é tratado como falta', () => {
    const s = computeStreak(days({ '2026-11-20': 'complete' }), '2026-11-20', '2026-11-10', {
      restDaysPerWeek: 0,
    });
    expect(s.current).toBe(1);
  });
});
