import { friendAlertBadge, todayInvite } from './friendAlerts';

describe('friendAlertBadge', () => {
  test('sem convites, sem contador', () => {
    expect(friendAlertBadge(0)).toBeUndefined();
    expect(friendAlertBadge(-1)).toBeUndefined();
  });
  test('mostra o número, até 9+', () => {
    expect(friendAlertBadge(1)).toBe('1');
    expect(friendAlertBadge(9)).toBe('9');
    expect(friendAlertBadge(12)).toBe('9+');
  });
});

describe('todayInvite', () => {
  const reqs = [{ requestId: 'c' }, { requestId: 'b' }, { requestId: 'a' }];
  test('o mais novo primeiro, com quantos mais há', () => {
    expect(todayInvite(reqs, new Set())).toEqual({ request: { requestId: 'c' }, others: 2 });
  });
  test('pula os adiados', () => {
    expect(todayInvite(reqs, new Set(['c']))).toEqual({ request: { requestId: 'b' }, others: 1 });
  });
  test('todos adiados ou nenhum: sem cartão', () => {
    expect(todayInvite(reqs, new Set(['a', 'b', 'c']))).toBeNull();
    expect(todayInvite([], new Set())).toBeNull();
  });
});
