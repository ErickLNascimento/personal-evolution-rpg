import { dailyXp, dateRange, dayStatuses, firstHabitDate, streakFrom, weekSummary, type HabitLogEntry } from './progress';
import type { Habit } from './schedule';

// 2026-11-16 é segunda-feira; 2026-11-22 é domingo.
const daily: Habit = { id: 'a', title: 'Ler', difficulty: 'easy', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-11-16' };
const weekdays: Habit = { id: 'b', title: 'Treinar', difficulty: 'hard', scheduleDays: [1, 2, 3, 4, 5], startDate: '2026-11-16' };

const log = (habitId: string, ...dates: string[]): HabitLogEntry[] => dates.map((localDate) => ({ habitId, localDate }));

describe('dateRange', () => {
  it('inclui as pontas', () => {
    expect(dateRange('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(dateRange('2026-11-02', '2026-11-01')).toEqual([]);
  });
});

describe('situação dos dias', () => {
  it('completo, falta e sem missão', () => {
    const s = dayStatuses([weekdays], log('b', '2026-11-16'), '2026-11-16', '2026-11-22');
    expect(s.get('2026-11-16')).toBe('complete');
    expect(s.get('2026-11-17')).toBe('missed');
    expect(s.get('2026-11-22')).toBe('none'); // domingo fora da agenda
  });

  it('dia só é completo com todas as missões', () => {
    const s = dayStatuses([daily, weekdays], log('a', '2026-11-16'), '2026-11-16', '2026-11-16');
    expect(s.get('2026-11-16')).toBe('missed');
  });

  it('antes do início do hábito não há missão', () => {
    const s = dayStatuses([daily], [], '2026-11-14', '2026-11-15');
    expect([...s.values()]).toEqual(['none', 'none']);
  });
});

describe('streak a partir dos registros', () => {
  it('sem hábitos é zero', () => {
    expect(streakFrom([], [], '2026-11-22', 90)).toEqual({ current: 0, restDaysUsed: 0, capped: false });
    expect(firstHabitDate([])).toBeNull();
  });

  it('conta a sequência até hoje', () => {
    const logs = log('a', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22');
    expect(streakFrom([daily], logs, '2026-11-22', 90)).toEqual({ current: 4, restDaysUsed: 1, capped: false });
  });

  it('hoje ainda em andamento não quebra', () => {
    const logs = log('a', '2026-11-20', '2026-11-21');
    expect(streakFrom([daily], logs, '2026-11-22', 90).current).toBe(2);
  });

  it('marca quando a sequência chega ao limite da janela', () => {
    const habit = { ...daily, startDate: '2026-10-01' };
    const logs = log('a', ...dateRange('2026-10-01', '2026-11-22'));
    expect(streakFrom([habit], logs, '2026-11-22', 30)).toEqual({ current: 30, restDaysUsed: 0, capped: true });
    expect(streakFrom([habit], logs, '2026-11-22', 90).capped).toBe(false);
  });

  it('sequência quebrada dentro da janela não é marcada', () => {
    const habit = { ...daily, startDate: '2026-10-01' };
    const logs = log('a', ...dateRange('2026-11-20', '2026-11-22'));
    expect(streakFrom([habit], logs, '2026-11-22', 30)).toMatchObject({ current: 3, capped: false });
  });
});

describe('XP por dia', () => {
  it('soma por data, desconta estornos e preenche zeros', () => {
    const xp = [
      { amount: 10, localDate: '2026-11-20' },
      { amount: 20, localDate: '2026-11-20' },
      { amount: -10, localDate: '2026-11-20' },
      { amount: 30, localDate: '2026-11-22' },
    ];
    expect(dailyXp(xp, '2026-11-20', '2026-11-22')).toEqual([
      { date: '2026-11-20', xp: 20 },
      { date: '2026-11-21', xp: 0 },
      { date: '2026-11-22', xp: 30 },
    ]);
  });
});

describe('resumo semanal', () => {
  const logs = [
    ...log('a', '2026-11-16', '2026-11-17', '2026-11-18'),
    ...log('b', '2026-11-16', '2026-11-18'),
  ];
  const xp = [
    { amount: 40, localDate: '2026-11-16' },
    { amount: 999, localDate: '2026-11-23' }, // semana seguinte
  ];

  it('conta missões, dias perfeitos e XP da semana', () => {
    expect(weekSummary([daily, weekdays], logs, xp, '2026-11-19', '2026-11-22')).toEqual({
      weekStart: '2026-11-16',
      weekEnd: '2026-11-22',
      scheduled: 12, // 7 diárias + 5 em dias úteis
      completed: 5,
      rate: 5 / 12,
      perfectDays: 2, // segunda e quarta
      xp: 40,
    });
  });

  it('semana atual não conta dias futuros', () => {
    const s = weekSummary([daily, weekdays], logs, xp, '2026-11-18', '2026-11-18');
    expect(s.scheduled).toBe(6);
    expect(s.completed).toBe(5);
  });

  it('semana sem missão tem taxa zero', () => {
    expect(weekSummary([], [], [], '2026-11-18', '2026-11-22').rate).toBe(0);
  });
});
