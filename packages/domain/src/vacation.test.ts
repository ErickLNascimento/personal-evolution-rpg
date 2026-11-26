import { weeklyBoss } from './challenges';
import { dayStatuses, streakFrom } from './progress';
import { isHabitScheduledOn, missionsForDay, type Habit } from './schedule';
import { smartNotifications } from './smartNotifications';
import {
  currentOrNextVacation,
  endVacationEffect,
  isOnVacation,
  validateVacation,
  vacationDaysInYear,
  vacationLength,
  withVacations,
  VACATION_DAYS_PER_YEAR,
  VACATION_MAX_DAYS,
  type Vacation,
} from './vacation';

const TODAY = '2026-11-25'; // quarta-feira
const v = (id: string, startDate: string, endDate: string): Vacation => ({ id, startDate, endDate });
const daily: Habit = {
  id: 'h1',
  title: 'Ler',
  difficulty: 'easy',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-11-01',
};

describe('períodos de férias', () => {
  it('tamanho, dia de férias e dias por ano', () => {
    expect(vacationLength(v('a', '2026-11-25', '2026-11-25'))).toBe(1);
    expect(vacationLength(v('a', '2026-12-30', '2027-01-02'))).toBe(4);
    const list = [v('a', '2026-11-20', '2026-11-22')];
    expect(isOnVacation(list, '2026-11-21')).toBe(true);
    expect(isOnVacation(list, '2026-11-23')).toBe(false);
    expect(isOnVacation(undefined, '2026-11-21')).toBe(false);
    expect(vacationDaysInYear([v('a', '2026-12-30', '2027-01-02')], 2026)).toBe(2);
    expect(vacationDaysInYear([v('a', '2026-12-30', '2027-01-02')], 2027)).toBe(2);
  });

  it('férias de hoje ou a próxima', () => {
    const list = [v('old', '2026-11-01', '2026-11-03'), v('b', '2026-12-10', '2026-12-12'), v('a', '2026-11-24', '2026-11-26')];
    expect(currentOrNextVacation(list, TODAY)?.id).toBe('a');
    expect(currentOrNextVacation(list, '2026-11-27')?.id).toBe('b');
    expect(currentOrNextVacation(list, '2026-12-13')).toBeNull();
  });
});

describe('validação de um período novo', () => {
  it('aceita de hoje em diante, até o máximo de dias', () => {
    expect(validateVacation(TODAY, 7, TODAY, [])).toBeNull();
    expect(validateVacation(TODAY, VACATION_MAX_DAYS, TODAY, [])).toBeNull();
  });

  it('recusa passado, longe demais, duração inválida e sobreposição', () => {
    expect(validateVacation('2026-11-24', 3, TODAY, [])).toBe('As férias começam hoje ou depois.');
    expect(validateVacation('2027-02-01', 3, TODAY, [])).toMatch(/antecedência/);
    expect(validateVacation(TODAY, VACATION_MAX_DAYS + 1, TODAY, [])).toMatch(/de 1 a 14 dias/);
    expect(validateVacation(TODAY, 0, TODAY, [])).toMatch(/de 1 a 14 dias/);
    expect(validateVacation('2026-11-28', 3, TODAY, [v('a', '2026-11-30', '2026-12-02')])).toBe(
      'Essas datas cruzam outras férias.',
    );
    expect(validateVacation('2026-11-28', 2, TODAY, [v('a', '2026-11-30', '2026-12-02')])).toBeNull();
  });

  it('limite de dias por ano, contando cada ano separado', () => {
    const used = [v('a', '2026-01-05', '2026-01-18'), v('b', '2026-03-02', '2026-03-15')]; // 28 dias
    expect(vacationDaysInYear(used, 2026)).toBe(28);
    expect(validateVacation('2026-12-01', 2, TODAY, used)).toBeNull();
    expect(validateVacation('2026-12-01', 3, TODAY, used)).toBe(
      `Passa de ${VACATION_DAYS_PER_YEAR} dias de férias em 2026.`,
    );
    // 30/12 a 02/01: só 2 dias caem em 2026
    expect(validateVacation('2026-12-30', 4, TODAY, used)).toBeNull();
  });

  it('mensagens em inglês', () => {
    expect(validateVacation('2026-11-24', 3, TODAY, [], 'en')).toBe('Vacation must start today or later.');
  });
});

describe('encerrar as férias', () => {
  it('apaga as que não começaram, encurta as em andamento', () => {
    expect(endVacationEffect(v('a', '2026-11-26', '2026-11-30'), TODAY)).toEqual({ kind: 'delete' });
    expect(endVacationEffect(v('a', TODAY, '2026-11-30'), TODAY)).toEqual({ kind: 'delete' });
    expect(endVacationEffect(v('a', '2026-11-20', '2026-11-30'), TODAY)).toEqual({
      kind: 'shorten',
      endDate: '2026-11-24',
    });
    expect(endVacationEffect(v('a', '2026-11-01', '2026-11-03'), TODAY)).toEqual({ kind: 'none' });
  });
});

describe('férias na agenda, no streak e no chefe', () => {
  const vacations = [v('a', '2026-11-20', '2026-11-22')];
  const [habit] = withVacations([daily], vacations);

  it('dia de férias não tem missão', () => {
    expect(isHabitScheduledOn(habit!, '2026-11-21')).toBe(false);
    expect(isHabitScheduledOn(habit!, '2026-11-23')).toBe(true);
    expect(missionsForDay([habit!], new Set(), '2026-11-21')).toEqual([]);
  });

  it('dias de férias não contam nem quebram o streak', () => {
    const logs = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-23', '2026-11-24', TODAY].map(
      (localDate) => ({ habitId: 'h1', localDate }),
    );
    const statuses = dayStatuses([habit!], logs, '2026-11-15', TODAY);
    expect(statuses.get('2026-11-21')).toBe('none');
    const withBreak = streakFrom([daily], logs, TODAY, 30, { openDays: 1, restDaysPerWeek: 1 });
    const withVacation = streakFrom([habit!], logs, TODAY, 30, { openDays: 1, restDaysPerWeek: 1 });
    expect(withVacation.current).toBeGreaterThan(withBreak.current);
    expect(withVacation.current).toBe(8);
  });

  it('chefe da semana ignora os dias de férias', () => {
    const week = [v('w', '2026-11-23', '2026-11-26')]; // seg a qui
    const boss = weeklyBoss(withVacations([daily], week), new Map(), TODAY, '2026-11-23');
    expect(boss.maxHp).toBe(Math.ceil((3 * 80) / 100)); // só sex, sáb e dom
  });

  it('avisa na volta e não avisa streak em risco nas férias', () => {
    const habits = withVacations([daily], [v('a', TODAY, '2026-11-27')]);
    const out = smartNotifications({
      today: TODAY,
      nowMinutes: 600,
      now: new Date('2026-11-25T10:00:00'),
      habits,
      completedToday: new Set(),
      flash: null,
      promotion: null,
      vacationReturn: '2026-11-28',
    });
    expect(out.filter((n) => n.kind === 'streak').map((n) => ('date' in n ? n.date : ''))).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
    ]);
    expect(out.find((n) => n.kind === 'return')).toMatchObject({
      date: '2026-11-28',
      title: '🏕 Bem-vindo de volta',
    });
  });
});
