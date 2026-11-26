import { formatReminderTime, parseReminderTime, reminderSchedule, reminderTimesOfDay, repeatReminderDates, type ReminderHabit } from './reminders';

describe('horário do lembrete', () => {
  it('lê o formato da tela e o do Postgres', () => {
    expect(parseReminderTime('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseReminderTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseReminderTime('21:00:00')).toEqual({ hour: 21, minute: 0 });
  });

  it('recusa valores inválidos', () => {
    for (const v of ['24:00', '12:60', '8h', '', null, undefined]) expect(parseReminderTime(v)).toBeNull();
  });

  it('formata com dois dígitos', () => {
    expect(formatReminderTime({ hour: 7, minute: 5 })).toBe('07:05');
  });
});

describe('agenda de lembretes', () => {
  const base: ReminderHabit = { id: 'a', title: 'Ler', scheduleDays: [0, 1, 2, 3, 4, 5, 6], reminderTime: '08:00:00' };

  it('todos os dias vira um lembrete diário', () => {
    expect(reminderSchedule([base]).reminders).toEqual([{ habitId: 'a', title: 'Ler', weekday: null, hour: 8, minute: 0 }]);
  });

  it('dias da semana viram lembretes semanais com 1 = domingo', () => {
    const r = reminderSchedule([{ ...base, scheduleDays: [0, 3, 6] }]).reminders;
    expect(r.map((x) => x.weekday)).toEqual([1, 4, 7]);
  });

  it('ignora arquivados, sem horário e horário inválido', () => {
    const r = reminderSchedule([
      { ...base, id: 'x', archivedOn: '2026-11-01' },
      { ...base, id: 'y', reminderTime: null },
      { ...base, id: 'z', reminderTime: '99:99' },
    ]);
    expect(r.reminders).toEqual([]);
  });

  it('corta acima do limite do aparelho e avisa', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...base, id: String(i), scheduleDays: [1, 2, 3] }));
    const r = reminderSchedule(many, 10);
    expect(r.reminders).toHaveLength(10);
    expect(r.truncated).toBe(true);
    expect(reminderSchedule(many, 15).truncated).toBe(false);
  });
});

describe('lembretes ao longo do dia', () => {
  const agua = {
    id: 'agua',
    title: 'Beber água',
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '08:00',
    reminderEveryMinutes: 120,
    reminderUntil: '20:00',
  };
  const dias = [
    { date: '2026-11-26', weekday: 4 },
    { date: '2026-11-27', weekday: 5 },
  ];

  it('gera os horários do primeiro até o fim', () => {
    expect(reminderTimesOfDay(agua).map(formatReminderTime)).toEqual([
      '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00',
    ]);
    expect(reminderTimesOfDay({ ...agua, reminderEveryMinutes: null })).toHaveLength(1);
  });

  it('no máximo 12 por dia', () => {
    expect(reminderTimesOfDay({ ...agua, reminderTime: '00:00', reminderUntil: '23:59', reminderEveryMinutes: 60 })).toHaveLength(12);
  });

  it('hoje só os que faltam; amanhã o dia todo', () => {
    const r = repeatReminderDates([agua], { date: '2026-11-26', hour: 15, minute: 0 }, new Set(), dias);
    expect(r.filter((x) => x.date === '2026-11-26').map((x) => x.hour)).toEqual([16, 18, 20]);
    expect(r.filter((x) => x.date === '2026-11-27')).toHaveLength(7);
    expect(r[0]).toMatchObject({ index: 5, total: 7 });
  });

  it('meta batida hoje: para os de hoje', () => {
    const r = repeatReminderDates([agua], { date: '2026-11-26', hour: 9, minute: 0 }, new Set(['agua']), dias);
    expect(r.every((x) => x.date === '2026-11-27')).toBe(true);
  });

  it('só nos dias da agenda', () => {
    const r = repeatReminderDates([{ ...agua, scheduleDays: [5] }], { date: '2026-11-26', hour: 0, minute: 0 }, new Set(), dias);
    expect(new Set(r.map((x) => x.date))).toEqual(new Set(['2026-11-27']));
  });

  it('o lembrete semanal comum ignora os repetidos', () => {
    expect(reminderSchedule([agua]).reminders).toHaveLength(0);
  });
});
