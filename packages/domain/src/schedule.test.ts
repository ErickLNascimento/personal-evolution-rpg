import {
  ALL_DAYS,
  dayProgress,
  isHabitScheduledOn,
  missionsForDay,
  recentDays,
  type Habit,
} from './schedule';

const treino: Habit = {
  id: 'treino',
  title: 'Treinar',
  difficulty: 'hard',
  scheduleDays: [1, 2, 3, 4, 5], // segunda a sexta
  startDate: '2026-11-16',
};

const leitura: Habit = {
  id: 'leitura',
  title: 'Ler 10 páginas',
  difficulty: 'easy',
  scheduleDays: ALL_DAYS,
  startDate: '2026-11-20',
  archivedOn: '2026-11-30',
};

describe('agenda de hábitos', () => {
  it('respeita os dias da semana', () => {
    expect(isHabitScheduledOn(treino, '2026-11-23')).toBe(true); // segunda
    expect(isHabitScheduledOn(treino, '2026-11-22')).toBe(false); // domingo
  });

  it('não vale antes do início nem depois de arquivado', () => {
    expect(isHabitScheduledOn(leitura, '2026-11-19')).toBe(false);
    expect(isHabitScheduledOn(leitura, '2026-11-30')).toBe(true);
    expect(isHabitScheduledOn(leitura, '2026-12-01')).toBe(false);
  });

  it('monta as missões do dia e o progresso', () => {
    const missions = missionsForDay([treino, leitura], new Set(['leitura']), '2026-11-23');
    expect(missions.map((m) => [m.habit.id, m.done])).toEqual([
      ['treino', false],
      ['leitura', true],
    ]);
    expect(dayProgress(missions)).toEqual({ total: 2, done: 1, ratio: 0.5, perfect: false });
  });

  it('dia perfeito só com todas concluídas; dia vazio não é perfeito', () => {
    const all = missionsForDay([treino], new Set(['treino']), '2026-11-23');
    expect(dayProgress(all).perfect).toBe(true);
    expect(dayProgress([])).toEqual({ total: 0, done: 0, ratio: 0, perfect: false });
  });
});

describe('últimos dias (faixa da semana)', () => {
  const logged = new Map([
    ['2026-11-23', new Set(['treino', 'leitura'])],
    ['2026-11-22', new Set(['leitura'])],
  ]);
  const week = recentDays([treino, leitura], logged, '2026-11-23');

  it('vai do mais antigo até hoje, com 7 dias', () => {
    expect(week.map((d) => d.date)).toEqual([
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
    ]);
    expect(week.map((d) => d.weekday)).toEqual([2, 3, 4, 5, 6, 0, 1]);
  });

  it('marca hoje e só deixa registrar hoje e ontem', () => {
    expect(week.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-11-23']);
    expect(week.filter((d) => d.loggable).map((d) => d.date)).toEqual(['2026-11-22', '2026-11-23']);
  });

  it('calcula o progresso de cada dia pela agenda', () => {
    const byDate = Object.fromEntries(week.map((d) => [d.date, d.progress]));
    expect(byDate['2026-11-23']).toEqual({ total: 2, done: 2, ratio: 1, perfect: true });
    expect(byDate['2026-11-22']).toEqual({ total: 1, done: 1, ratio: 1, perfect: true }); // domingo: só leitura
    expect(byDate['2026-11-20']).toEqual({ total: 2, done: 0, ratio: 0, perfect: false }); // sem registros
    expect(byDate['2026-11-19']).toEqual({ total: 1, done: 0, ratio: 0, perfect: false }); // leitura ainda não valia
  });
});
