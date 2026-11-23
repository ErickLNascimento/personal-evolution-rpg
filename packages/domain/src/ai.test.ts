import { canDecide, parseAiPlan } from './ai';

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
