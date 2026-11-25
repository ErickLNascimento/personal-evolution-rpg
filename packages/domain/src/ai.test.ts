import { canDecide, normalizePlanRequest, parseAiPlan, validateSuggestionEdit } from './ai';

const valid = {
  title: '  Ler   10 páginas ',
  difficulty: 'easy',
  schedule_days: [5, 1, 1, 3],
  objective_title: 'Conhecimento',
  objective_category: 'knowledge',
  rationale: 'Leitura curta todo dia cria constância.',
};

describe('plano da IA', () => {
  it('lê resumo e sugestões, limpando os campos', () => {
    const plan = parseAiPlan({ summary: ' Bom começo! ', habits: [valid] });
    expect(plan.summary).toBe('Bom começo!');
    expect(plan.suggestions).toEqual([
      {
        index: 0,
        title: 'Ler 10 páginas',
        difficulty: 'easy',
        scheduleDays: [1, 3, 5],
        objectiveTitle: 'Conhecimento',
        objectiveCategory: 'knowledge',
        rationale: 'Leitura curta todo dia cria constância.',
      },
    ]);
  });

  it('descarta sugestões inválidas mantendo a posição original', () => {
    const plan = parseAiPlan({
      summary: 'x',
      habits: [{ ...valid, title: '' }, null, { ...valid, difficulty: 'épica' }, { ...valid, schedule_days: [9] }, valid],
    });
    expect(plan.suggestions.map((s) => s.index)).toEqual([4]);
  });

  it('objetivo vazio vira nulo e categoria desconhecida cai no padrão', () => {
    const [s] = parseAiPlan({ habits: [{ ...valid, objective_title: '  ', objective_category: 'nada' }] }).suggestions;
    expect(s?.objectiveTitle).toBeNull();
    expect(s?.objectiveCategory).toBe('personal_growth');
  });

  it('aguenta payload malformado', () => {
    expect(parseAiPlan(null)).toEqual({ summary: '', suggestions: [] });
    expect(parseAiPlan({ habits: 'não é lista' })).toEqual({ summary: '', suggestions: [] });
  });

  it('só plano proposto pode ser decidido', () => {
    expect(canDecide('proposed')).toBe(true);
    expect(canDecide('accepted')).toBe(false);
    expect(canDecide('rejected')).toBe(false);
  });
});

describe('pedido do plano', () => {
  const draft = { goal: '  voltar a   correr ', minutesPerDay: 20 as const, freeDays: [5, 1, 1, 3], pastAttempts: '' };

  it('limpa os textos e normaliza os dias', () => {
    expect(normalizePlanRequest(draft)).toEqual({
      value: { goal: 'voltar a correr', minutes_per_day: 20, free_days: [1, 3, 5], past_attempts: null },
      error: null,
    });
  });

  it('tudo opcional, mas precisa de um dia livre e respeita os tamanhos', () => {
    expect(normalizePlanRequest({ ...draft, goal: '', minutesPerDay: null }).value?.goal).toBeNull();
    expect(normalizePlanRequest({ ...draft, freeDays: [] }).error).not.toBeNull();
    expect(normalizePlanRequest({ ...draft, goal: 'a'.repeat(301) }).error).not.toBeNull();
    expect(normalizePlanRequest({ ...draft, pastAttempts: 'a'.repeat(201) }).error).not.toBeNull();
  });
});

describe('ajuste de sugestão', () => {
  it('aceita e limpa o ajuste', () => {
    expect(validateSuggestionEdit(2, { title: ' Ler  3 páginas ', difficulty: 'easy', scheduleDays: [3, 1] })).toEqual({
      value: { index: 2, title: 'Ler 3 páginas', difficulty: 'easy', schedule_days: [1, 3] },
      error: null,
    });
  });

  it('recusa sem nome ou sem dias', () => {
    expect(validateSuggestionEdit(0, { title: ' ', difficulty: 'easy', scheduleDays: [1] }).error).not.toBeNull();
    expect(validateSuggestionEdit(0, { title: 'Ler', difficulty: 'easy', scheduleDays: [] }).error).not.toBeNull();
  });
});

describe('mensagens da IA em inglês', () => {
  it('pedido e ajuste', () => {
    expect(
      normalizePlanRequest({ goal: '', minutesPerDay: null, freeDays: [], pastAttempts: '' }, 'en').error,
    ).toBe('Pick at least one free day.');
    expect(validateSuggestionEdit(0, { title: ' ', difficulty: 'easy', scheduleDays: [1] }, 'en').error).toBe(
      'Give the habit a name.',
    );
  });
});
