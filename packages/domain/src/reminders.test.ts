import { formatReminderTime, parseReminderTime, reminderSchedule, type ReminderHabit } from './reminders';

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
