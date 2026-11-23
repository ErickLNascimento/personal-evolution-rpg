import {
  describeSchedule,
  normalizeScheduleDays,
  retireHabit,
  toggleScheduleDay,
  validateHabitDraft,
  validateObjectiveTitle,
  type HabitDraft,
} from './habits';

const draft: HabitDraft = {
  title: 'Ler 10 páginas',
  difficulty: 'easy',
  scheduleDays: [1, 3, 5],
  objectiveId: null,
  targetQty: '',
  unit: '',
};

describe('agenda', () => {
  it('normaliza dias repetidos, fora da faixa e fora de ordem', () => {
    expect(normalizeScheduleDays([5, 1, 1, 7, -1, 3])).toEqual([1, 3, 5]);
  });

  it('liga e desliga dias', () => {
    expect(toggleScheduleDay([1, 3], 5)).toEqual([1, 3, 5]);
    expect(toggleScheduleDay([1, 3], 3)).toEqual([1]);
  });

  it('descreve a agenda', () => {
    expect(describeSchedule([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias');
    expect(describeSchedule([5, 4, 3, 2, 1])).toBe('Dias úteis');
    expect(describeSchedule([6, 0])).toBe('Fins de semana');
    expect(describeSchedule([1, 3, 5])).toBe('Seg, Qua, Sex');
  });
});

describe('formulário de hábito', () => {
  it('aceita e limpa um hábito válido', () => {
    const r = validateHabitDraft({ ...draft, title: '  Ler   10 páginas ', scheduleDays: [5, 1, 3, 3] });
    expect(r).toEqual({
      ok: true,
      value: {
        title: 'Ler 10 páginas',
        difficulty: 'easy',
        scheduleDays: [1, 3, 5],
        objectiveId: null,
        targetQty: null,
        unit: null,
        reminderTime: null,
      },
    });
  });

  it('exige nome e ao menos um dia', () => {
    const r = validateHabitDraft({ ...draft, title: '  ', scheduleDays: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBeDefined();
      expect(r.errors.scheduleDays).toBeDefined();
    }
  });

  it('limita o nome a 120 caracteres', () => {
    expect(validateHabitDraft({ ...draft, title: 'a'.repeat(120) }).ok).toBe(true);
    expect(validateHabitDraft({ ...draft, title: 'a'.repeat(121) }).ok).toBe(false);
  });

  it('meta opcional aceita vírgula e precisa ser positiva', () => {
    const r = validateHabitDraft({ ...draft, targetQty: '2,5', unit: ' km ' });
    expect(r.ok && r.value).toMatchObject({ targetQty: 2.5, unit: 'km' });
    expect(validateHabitDraft({ ...draft, targetQty: '0' }).ok).toBe(false);
    expect(validateHabitDraft({ ...draft, targetQty: 'abc' }).ok).toBe(false);
  });

  it('unidade só com meta e até 20 caracteres', () => {
    expect(validateHabitDraft({ ...draft, unit: 'páginas' }).ok).toBe(false);
    expect(validateHabitDraft({ ...draft, targetQty: '10', unit: 'a'.repeat(21) }).ok).toBe(false);
  });
});

describe('lembrete no formulário', () => {
  it('normaliza o horário e aceita sem lembrete', () => {
    const r = validateHabitDraft({ ...draft, reminderTime: '7:05' });
    expect(r.ok && r.value.reminderTime).toBe('07:05');
    expect(validateHabitDraft({ ...draft, reminderTime: null }).ok).toBe(true);
  });

  it('recusa horário inválido', () => {
    const r = validateHabitDraft({ ...draft, reminderTime: '25:00' });
    expect(!r.ok && r.errors.reminderTime).toBeTruthy();
  });
});

describe('objetivo', () => {
  it('valida o título', () => {
    expect(validateObjectiveTitle('  Ter   mais saúde ')).toEqual({ value: 'Ter mais saúde', error: null });
    expect(validateObjectiveTitle(' ').error).not.toBeNull();
    expect(validateObjectiveTitle('a'.repeat(121)).error).not.toBeNull();
  });
});

describe('tirar hábito da rotina', () => {
  const today = '2026-11-22';

  it('feito hoje: arquiva com hoje como último dia', () => {
    expect(retireHabit({ startDate: '2026-11-01' }, today, true)).toEqual({ kind: 'archive', archivedOn: today });
    expect(retireHabit({ startDate: today }, today, true)).toEqual({ kind: 'archive', archivedOn: today });
  });

  it('não feito hoje: arquiva com ontem como último dia', () => {
    expect(retireHabit({ startDate: '2026-11-01' }, today, false)).toEqual({ kind: 'archive', archivedOn: '2026-11-21' });
    expect(retireHabit({ startDate: '2026-11-21' }, today, false)).toEqual({ kind: 'archive', archivedOn: '2026-11-21' });
  });

  it('sem histórico (começa hoje ou depois): exclui', () => {
    expect(retireHabit({ startDate: today }, today, false)).toEqual({ kind: 'delete' });
    expect(retireHabit({ startDate: '2026-11-30' }, today, false)).toEqual({ kind: 'delete' });
  });
});
