import { hoursUntilAwake, isQuietHour, pushDecision, type PushDecisionInput } from './push';

const base: PushDecisionInput = {
  category: 'bosses',
  enabled: true,
  hasToken: true,
  localHour: 12,
  cappedSentToday: 0,
  ageHours: 1,
};

describe('silêncio', () => {
  test('das 22h às 8h', () => {
    expect([21, 22, 23, 0, 7, 8].map(isQuietHour)).toEqual([false, true, true, true, true, false]);
  });
  test('espera até as 8h', () => {
    expect(hoursUntilAwake(23)).toBe(9);
    expect(hoursUntilAwake(6, 30)).toBe(1.5);
    expect(hoursUntilAwake(12)).toBe(0);
  });
});

describe('pushDecision', () => {
  test('envia no horário com tudo certo', () => {
    expect(pushDecision(base)).toBe('send');
  });
  test('preferência desligada e sem aparelho', () => {
    expect(pushDecision({ ...base, enabled: false })).toBe('skip_prefs');
    expect(pushDecision({ ...base, hasToken: false })).toBe('skip_no_token');
  });
  test('à noite espera', () => {
    expect(pushDecision({ ...base, localHour: 23 })).toBe('defer');
  });
  test('limite do dia vale para Chefes e Reengajamento, não para Social', () => {
    expect(pushDecision({ ...base, cappedSentToday: 3 })).toBe('skip_cap');
    expect(pushDecision({ ...base, category: 'reengage', cappedSentToday: 3 })).toBe('skip_cap');
    expect(pushDecision({ ...base, category: 'social', cappedSentToday: 9 })).toBe('send');
  });
  test('velho demais na fila', () => {
    expect(pushDecision({ ...base, ageHours: 49 })).toBe('skip_stale');
  });
});
