import { recapTier, recapWeekStart, shouldShowRecap, weeklyRecap } from './recap';
import type { Habit } from './schedule';
import { withVacations } from './vacation';

// 2026-11-30 é segunda-feira; a semana resumida vai de 23/11 (seg) a 29/11 (dom).
const MONDAY = '2026-11-30';
const daily = (id: string, title: string): Habit => ({
  id,
  title,
  difficulty: 'easy',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-11-01',
});
const logsFor = (habitId: string, dates: string[]) => dates.map((localDate) => ({ habitId, localDate }));
const week = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `2026-11-${String(from + i).padStart(2, '0')}`);

describe('quando mostrar o resumo', () => {
  it('de segunda a quarta, até ser fechado na semana', () => {
    expect(recapWeekStart(MONDAY)).toBe('2026-11-23');
    expect(shouldShowRecap(MONDAY, null)).toBe(true);
    expect(shouldShowRecap('2026-12-02', null)).toBe(true); // quarta
    expect(shouldShowRecap('2026-12-03', null)).toBe(false); // quinta
    expect(shouldShowRecap(MONDAY, '2026-11-23')).toBe(false);
    expect(shouldShowRecap(MONDAY, '2026-11-16')).toBe(true); // fechado na semana anterior
  });

  it('manchete pela taxa', () => {
    expect(recapTier(0.95)).toBe('legendary');
    expect(recapTier(0.7)).toBe('great');
    expect(recapTier(0.4)).toBe('good');
    expect(recapTier(0.1)).toBe('restart');
  });
});

describe('resumo da semana anterior', () => {
  const habits = [daily('ler', 'Ler'), daily('agua', 'Beber água')];

  it('conta missões, compara com a semana de antes e acha o hábito mais constante', () => {
    const logs = [
      ...logsFor('ler', week(23, 29)), // 7/7
      ...logsFor('agua', week(23, 26)), // 4/7
      ...logsFor('ler', week(16, 18)), // semana de antes: 3
    ];
    const xp = [
      { localDate: '2026-11-24', amount: 100 },
      { localDate: '2026-11-17', amount: 40 },
    ];
    const r = weeklyRecap(habits, logs, xp, MONDAY)!;
    expect(r.week.completed).toBe(11);
    expect(r.week.scheduled).toBe(14);
    expect(r.week.perfectDays).toBe(4);
    expect(r.tier).toBe('great'); // 11/14 ≈ 0,79
    expect(r.completedDelta).toBe(8);
    expect(r.xpDelta).toBe(60);
    expect(r.bestHabit).toEqual({ id: 'ler', title: 'Ler', done: 7, scheduled: 7 });
    expect(r.bossDefeated).toBe(false); // vida = 80% de 14 = 12 (arredondado para cima) > 11
  });

  it('chefe derrotado com 80% das missões', () => {
    const logs = [...logsFor('ler', week(23, 29)), ...logsFor('agua', week(23, 27))]; // 12/14
    expect(weeklyRecap(habits, logs, [], MONDAY)!.bossDefeated).toBe(true);
    const fewer = [...logsFor('ler', week(23, 29)), ...logsFor('agua', week(23, 26))]; // 11/14
    expect(weeklyRecap(habits, fewer, [], MONDAY)!.bossDefeated).toBe(false);
  });

  it('sem hábito destaque quando nada foi feito', () => {
    const r = weeklyRecap(habits, [], [], MONDAY)!;
    expect(r.bestHabit).toBeNull();
    expect(r.tier).toBe('restart');
  });

  it('semana sem agenda (nova ou de férias) não tem resumo', () => {
    expect(weeklyRecap([], [], [], MONDAY)).toBeNull();
    const onVacation = withVacations(habits, [{ id: 'v', startDate: '2026-11-23', endDate: '2026-11-29' }]);
    expect(weeklyRecap(onVacation, [], [], MONDAY)).toBeNull();
  });
});
