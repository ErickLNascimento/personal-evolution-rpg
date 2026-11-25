import { ALL_DAYS, type Habit } from './schedule';
import {
  SMART_NOTIFICATION_SLOTS,
  smartNotifications,
  type SmartNotificationInput,
} from './smartNotifications';

const daily: Habit = {
  id: 'a',
  title: 'Alongar',
  difficulty: 'easy',
  scheduleDays: ALL_DAYS,
  startDate: '2026-11-01',
};
const weekdays: Habit = {
  id: 'b',
  title: 'Treinar',
  difficulty: 'hard',
  scheduleDays: [1, 2, 3, 4, 5],
  startDate: '2026-11-01',
};

const base: SmartNotificationInput = {
  today: '2026-11-23', // segunda
  nowMinutes: 10 * 60,
  now: new Date('2026-11-23T13:00:00Z'),
  habits: [daily, weekdays],
  completedToday: new Set(),
  flash: null,
  promotion: null,
};

describe('notificações inteligentes', () => {
  it('streak em risco hoje e nos próximos dias com missão', () => {
    const n = smartNotifications(base);
    const streak = n.filter((x) => x.kind === 'streak');
    expect(streak).toHaveLength(7);
    expect(streak[0]).toMatchObject({ date: '2026-11-23', hour: 20, minute: 30 });
    expect(streak[0]!.body).toContain('Faltam 2 missões');
  });

  it('hoje perfeito ou depois das 20h30: sem aviso de hoje', () => {
    const perfect = smartNotifications({ ...base, completedToday: new Set(['a', 'b']) });
    expect(perfect.some((x) => x.kind === 'streak' && x.date === '2026-11-23')).toBe(false);
    const late = smartNotifications({ ...base, nowMinutes: 21 * 60 });
    expect(late.some((x) => x.kind === 'streak' && x.date === '2026-11-23')).toBe(false);
    expect(late.some((x) => x.kind === 'streak' && x.date === '2026-11-24')).toBe(true);
  });

  it('dia sem missão não tem aviso', () => {
    const onlyWeekdays = smartNotifications({ ...base, habits: [weekdays] });
    const dates = onlyWeekdays
      .filter((x) => x.kind === 'streak')
      .map((x) => (x.kind === 'streak' ? x.date : ''));
    expect(dates).not.toContain('2026-11-28'); // sábado
    expect(dates).not.toContain('2026-11-29'); // domingo
  });

  it('missão relâmpago: 1 hora antes do prazo, se não foi feita', () => {
    const deadline = new Date('2026-11-23T16:00:00Z');
    const n = smartNotifications({ ...base, flash: { title: 'Ler', deadline, done: false } });
    const flash = n.find((x) => x.kind === 'flash');
    expect(flash && flash.kind === 'flash' && flash.at.toISOString()).toBe(
      '2026-11-23T15:00:00.000Z',
    );
    expect(
      smartNotifications({ ...base, flash: { title: 'Ler', deadline, done: true } }).some(
        (x) => x.kind === 'flash',
      ),
    ).toBe(false);
    // Menos de 1 hora até o prazo: já passou da hora do aviso.
    const soon = new Date('2026-11-23T13:30:00Z');
    expect(
      smartNotifications({ ...base, flash: { title: 'Ler', deadline: soon, done: false } }).some(
        (x) => x.kind === 'flash',
      ),
    ).toBe(false);
  });

  it('promoção: lembrete na manhã seguinte', () => {
    const n = smartNotifications({ ...base, promotion: { nextName: 'Cavaleiro' } });
    expect(n.find((x) => x.kind === 'promotion')).toMatchObject({
      date: '2026-11-24',
      hour: 9,
      minute: 0,
    });
  });

  it('nunca passa das vagas reservadas', () => {
    const all = smartNotifications({
      ...base,
      flash: { title: 'Ler', deadline: new Date('2026-11-23T18:00:00Z'), done: false },
      promotion: { nextName: 'Cavaleiro' },
    });
    expect(all.length).toBeLessThanOrEqual(SMART_NOTIFICATION_SLOTS);
  });
});

describe('avisos em inglês', () => {
  it('traduz título e texto quando locale = en', () => {
    const out = smartNotifications({
      today: '2026-11-24',
      nowMinutes: 600,
      now: new Date('2026-11-24T10:00:00'),
      habits: [],
      completedToday: new Set(),
      flash: null,
      promotion: { nextName: 'Knight' },
      locale: 'en',
    });
    expect(out).toEqual([
      expect.objectContaining({
        title: '⭐ Promotion available',
        body: 'Your hero can become Knight. Tap to accept.',
      }),
    ]);
  });
});

describe('aviso de emboscada', () => {
  const base = {
    today: '2026-11-24',
    nowMinutes: 600,
    now: new Date('2026-11-24T10:00:00'),
    habits: [],
    completedToday: new Set<string>(),
    flash: null,
    promotion: null,
  };
  it('avisa às 9h do dia em que começa; não avisa se já passou das 9h desse dia', () => {
    const ambush = { date: '2026-11-25', name: 'Goblin do Atraso', goal: '4 missões' };
    expect(smartNotifications({ ...base, ambush })).toEqual([
      expect.objectContaining({ kind: 'ambush', date: '2026-11-25', hour: 9, body: 'Goblin do Atraso apareceu. Desafio de 2 dias: 4 missões.' }),
    ]);
    expect(smartNotifications({ ...base, ambush: { ...ambush, date: '2026-11-24' } })).toEqual([]);
  });
});
