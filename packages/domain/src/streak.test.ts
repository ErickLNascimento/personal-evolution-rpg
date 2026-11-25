import { computeStreak, shieldTargets, type DayStatus } from './streak';

const days = (entries: Record<string, DayStatus>) => new Map(Object.entries(entries));

describe('streak', () => {
  it('conta dias completos seguidos', () => {
    const s = computeStreak(
      days({ '2026-11-18': 'complete', '2026-11-19': 'complete', '2026-11-20': 'complete' }),
      '2026-11-20',
      '2026-11-18',
    );
    expect(s).toEqual({ current: 3, restDaysUsed: 0, shieldsUsed: 0 });
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
      days({
        '2026-11-20': 'complete',
        '2026-11-21': 'none',
        '2026-11-22': 'none',
        '2026-11-23': 'complete',
      }),
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
    expect(s).toEqual({ current: 3, restDaysUsed: 1, shieldsUsed: 0 });
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
    expect(s).toEqual({ current: 1, restDaysUsed: 1, shieldsUsed: 0 });
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
    expect(s).toEqual({ current: 2, restDaysUsed: 2, shieldsUsed: 0 });
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

describe('dias em aberto e escudos', () => {
  // Domingo 22/11 é hoje; semana de segunda 16 a domingo 22.
  const today = '2026-11-22';
  const st = (entries: [string, DayStatus][]) => new Map<string, DayStatus>(entries);
  const base: [string, DayStatus][] = [
    ['2026-11-13', 'complete'],
    ['2026-11-14', 'complete'],
    ['2026-11-15', 'complete'],
    ['2026-11-16', 'complete'],
    ['2026-11-17', 'missed'], // segunda falta da semana: quebra
    ['2026-11-18', 'missed'], // falta mais recente: perdoada (folga da semana)
    ['2026-11-19', 'complete'],
    ['2026-11-20', 'complete'],
    ['2026-11-21', 'missed'], // ontem: ainda dá para registrar
    ['2026-11-22', 'missed'], // hoje em andamento
  ];

  it('ontem em aberto não gasta a folga da semana (com openDays = 1)', () => {
    const recent = st([
      ['2026-11-16', 'complete'],
      ['2026-11-17', 'missed'],
      ['2026-11-18', 'complete'],
      ['2026-11-19', 'complete'],
      ['2026-11-20', 'complete'],
      ['2026-11-21', 'missed'], // ontem
      ['2026-11-22', 'missed'], // hoje
    ]);
    // Sem openDays, ontem gasta a folga e o dia 17 quebra: 18, 19, 20.
    expect(computeStreak(recent, today, '2026-11-16').current).toBe(3);
    // Com openDays, ontem fica em aberto, a folga cobre o 17 e a sequência inclui o 16.
    expect(computeStreak(recent, today, '2026-11-16', { openDays: 1 }).current).toBe(4);
  });

  it('um escudo segura a falta que quebraria', () => {
    const r = computeStreak(st(base), today, '2026-11-13', {
      openDays: 1,
      shielded: new Set(['2026-11-17']),
    });
    expect(r).toEqual({ current: 6, restDaysUsed: 1, shieldsUsed: 1 });
  });

  it('acha o dia em que o escudo deve ser usado', () => {
    expect(shieldTargets(st(base), today, '2026-11-13', 2, { openDays: 1 })).toEqual([
      '2026-11-17',
    ]);
    expect(shieldTargets(st(base), today, '2026-11-13', 0, { openDays: 1 })).toEqual([]);
  });

  it('não usa escudo em dia ainda aberto nem fora da janela de 7 dias', () => {
    const recent = st([
      ['2026-11-20', 'complete'],
      ['2026-11-21', 'missed'],
      ['2026-11-22', 'missed'],
    ]);
    expect(shieldTargets(recent, today, '2026-11-20', 2, { openDays: 1 })).toEqual([]);
    const old = st([
      ['2026-11-09', 'missed'],
      ['2026-11-10', 'missed'], // quebra há 12 dias: fora da janela
      ...([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const).map(
        (d) => [`2026-11-${d}`, 'complete'] as [string, DayStatus],
      ),
    ]);
    expect(shieldTargets(old, today, '2026-11-09', 2, { openDays: 1 })).toEqual([]);
  });

  it('dois escudos para duas quebras seguidas', () => {
    const two = st([
      ['2026-11-16', 'complete'],
      ['2026-11-17', 'missed'],
      ['2026-11-18', 'missed'],
      ['2026-11-19', 'missed'], // mais recente: folga
      ['2026-11-20', 'complete'],
      ['2026-11-21', 'complete'],
      ['2026-11-22', 'complete'],
    ]);
    expect(shieldTargets(two, today, '2026-11-16', 2, { openDays: 1 })).toEqual([
      '2026-11-18',
      '2026-11-17',
    ]);
    expect(shieldTargets(two, today, '2026-11-16', 1, { openDays: 1 })).toEqual(['2026-11-18']);
  });
});
