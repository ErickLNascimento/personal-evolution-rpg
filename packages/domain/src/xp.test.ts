import {
  DEFAULT_XP_TABLE,
  habitLogXpKey,
  perfectDayXpKey,
  reversalKey,
  xpBalance,
  xpForHabit,
  xpTableFromRules,
} from './xp';

describe('XP', () => {
  it('concede XP pela dificuldade', () => {
    expect(xpForHabit('easy')).toBe(10);
    expect(xpForHabit('medium')).toBe(20);
    expect(xpForHabit('hard')).toBe(30);
    expect(DEFAULT_XP_TABLE.perfectDayBonus).toBe(20);
  });

  it('aceita tabela configurável', () => {
    const table = { habit: { easy: 5, medium: 15, hard: 40 }, perfectDayBonus: 0 };
    expect(xpForHabit('hard', table)).toBe(40);
  });

  it('gera chaves estáveis', () => {
    expect(habitLogXpKey('log-1')).toBe('habit-log:log-1');
    expect(perfectDayXpKey('u1', '2026-11-22')).toBe('perfect-day:u1:2026-11-22:1');
    expect(perfectDayXpKey('u1', '2026-11-22', 2)).toBe('perfect-day:u1:2026-11-22:2');
    expect(reversalKey('habit-log:log-1')).toBe('reversal:habit-log:log-1');
  });

  it('não conta XP duplicado', () => {
    const key = habitLogXpKey('log-1');
    expect(
      xpBalance([
        { amount: 20, idempotencyKey: key },
        { amount: 20, idempotencyKey: key },
      ]),
    ).toBe(20);
  });

  it('desfazer estorna o valor e permite registrar de novo', () => {
    const key = habitLogXpKey('log-1');
    expect(
      xpBalance([
        { amount: 20, idempotencyKey: key },
        { amount: -20, idempotencyKey: reversalKey(key) },
      ]),
    ).toBe(0);
    // registrar de novo gera um registro novo, com outra chave
    expect(
      xpBalance([
        { amount: 20, idempotencyKey: key },
        { amount: -20, idempotencyKey: reversalKey(key) },
        { amount: 20, idempotencyKey: habitLogXpKey('log-2') },
      ]),
    ).toBe(20);
  });
});

describe('tabela de XP do banco', () => {
  it('usa os valores de xp_rules', () => {
    const t = xpTableFromRules([
      { key: 'habit_easy', amount: 5 },
      { key: 'habit_medium', amount: 15 },
      { key: 'habit_hard', amount: 40 },
      { key: 'perfect_day_bonus', amount: 0 },
    ]);
    expect(t).toEqual({ habit: { easy: 5, medium: 15, hard: 40 }, perfectDayBonus: 0 });
  });

  it('cai no padrão para chave ausente ou inválida', () => {
    const t = xpTableFromRules([{ key: 'habit_hard', amount: -3 }]);
    expect(t).toEqual(DEFAULT_XP_TABLE);
  });
});
