import {
  bossForWeek,
  BOSSES,
  canStartJourney,
  journeyEnd,
  journeyProgress,
  journeyRequired,
  weeklyBoss,
} from './challenges';
import { addDays } from './dates';
import type { Habit } from './schedule';

// 2026-11-16 é segunda-feira.
const diario: Habit = {
  id: 'agua',
  title: 'Beber água',
  difficulty: 'easy',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-11-01',
};
const semana: Habit = { ...diario, id: 'treino', scheduleDays: [1, 2, 3, 4, 5] };

const days = (start: string, n: number, skip: number[] = []) =>
  new Set(Array.from({ length: n }, (_, i) => i).filter((i) => !skip.includes(i)).map((i) => addDays(start, i)));

describe('jornada', () => {
  const journey = { startDate: '2026-11-16', lengthDays: 21 as const };

  it('termina no dia 21 e exige 80% dos dias da agenda', () => {
    expect(journeyEnd('2026-11-16', 21)).toBe('2026-12-06');
    expect(journeyRequired(21)).toBe(17);
    expect(journeyRequired(15)).toBe(12);
  });

  it('em andamento mostra o dia e as faltas que ainda cabem', () => {
    const p = journeyProgress(diario, days('2026-11-16', 5, [2]), journey, '2026-11-21');
    expect(p).toMatchObject({ day: 6, scheduled: 21, required: 17, done: 4, missed: 1, missesLeft: 3, outcome: null });
  });

  it('hoje e ontem sem registro ainda não são falta', () => {
    const p = journeyProgress(diario, days('2026-11-16', 3), journey, '2026-11-20');
    expect(p.missed).toBe(0);
  });

  it('vence antes do fim ao bater o mínimo', () => {
    const p = journeyProgress(diario, days('2026-11-16', 17), journey, '2026-12-02');
    expect(p.outcome).toBe('won');
  });

  it('perde antes do fim quando as faltas passam do limite', () => {
    const p = journeyProgress(diario, days('2026-11-16', 10, [0, 1, 2, 3, 4]), journey, '2026-11-26');
    expect(p.missed).toBe(5);
    expect(p.outcome).toBe('lost');
  });

  it('só conta os dias da agenda do hábito', () => {
    const p = journeyProgress(semana, new Set<string>(), journey, '2026-11-16');
    expect(p.scheduled).toBe(15);
    expect(p.required).toBe(12);
  });

  it('o dia não passa do último', () => {
    expect(journeyProgress(diario, new Set(), journey, '2027-01-30').day).toBe(21);
  });

  it('limita jornadas ativas e uma por hábito', () => {
    const active = (habitId: string) => ({ habitId, status: 'active' as const });
    expect(canStartJourney('a', [])).toBeNull();
    expect(canStartJourney('a', [active('a')])).toMatch(/já está/);
    expect(canStartJourney('d', [active('a'), active('b'), active('c')])).toMatch(/3 jornadas/);
    expect(canStartJourney('a', [{ habitId: 'a', status: 'won' }])).toBeNull();
  });
});

describe('chefe da semana', () => {
  it('vida = 80% das missões agendadas; cada missão feita tira 1', () => {
    // 7 missões do diário + 5 do treino = 12 → vida 10
    const logged = new Map([
      ['2026-11-16', new Set(['agua', 'treino'])],
      ['2026-11-17', new Set(['agua'])],
    ]);
    const b = weeklyBoss([diario, semana], logged, '2026-11-18');
    expect(b).toMatchObject({ weekStart: '2026-11-16', weekEnd: '2026-11-22', maxHp: 10, damage: 3, hp: 7, defeated: false });
  });

  it('é derrotado ao zerar a vida', () => {
    const logged = new Map(Array.from(days('2026-11-16', 6), (d) => [d, new Set(['agua'])] as const));
    const b = weeklyBoss([diario], logged, '2026-11-22');
    expect(b.maxHp).toBe(6);
    expect(b.defeated).toBe(true);
    expect(b.hp).toBe(0);
  });

  it('sem missões não há o que derrotar', () => {
    expect(weeklyBoss([], new Map(), '2026-11-18').defeated).toBe(false);
  });

  it('o chefe muda a cada semana e repete o ciclo', () => {
    const a = bossForWeek('2026-11-16');
    expect(bossForWeek('2026-11-23')).not.toEqual(a);
    expect(bossForWeek(addDays('2026-11-16', 7 * BOSSES.length))).toEqual(a);
  });
});
