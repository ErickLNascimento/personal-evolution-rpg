import { duoGoalText, duoPhase, duoReward, sortDuoQuests, type DuoQuestState } from './duoQuests';

const base: DuoQuestState = {
  weekStart: '2026-11-23',
  status: 'active',
  target: 5,
  myDone: 0,
  partnerDone: 0,
  claimed: false,
  iInvited: true,
};

describe('duoReward', () => {
  test('mesmos prêmios do banco', () => {
    expect([3, 5, 7].map(duoReward)).toEqual([30, 50, 80]);
    expect(duoReward(4)).toBe(0);
  });
});

describe('duoPhase', () => {
  test('convite pendente: quem recebe responde, quem enviou espera', () => {
    expect(duoPhase({ ...base, status: 'pending', iInvited: false }, '2026-11-25')).toBe('invited');
    expect(duoPhase({ ...base, status: 'pending' }, '2026-11-25')).toBe('waiting');
    expect(duoPhase({ ...base, status: 'pending' }, '2026-11-30')).toBe('over');
  });
  test('só resgata quando os dois cumprem', () => {
    expect(duoPhase({ ...base, myDone: 5, partnerDone: 4 }, '2026-11-25')).toBe('active');
    expect(duoPhase({ ...base, myDone: 5, partnerDone: 5 }, '2026-11-25')).toBe('claimable');
  });
  test('prazo de resgate: 7 dias depois do domingo', () => {
    const done = { ...base, myDone: 5, partnerDone: 5 };
    expect(duoPhase(done, '2026-12-06')).toBe('claimable');
    expect(duoPhase(done, '2026-12-07')).toBe('over');
    expect(duoPhase({ ...base, myDone: 5 }, '2026-11-30')).toBe('over');
  });
  test('resgatada', () => {
    expect(duoPhase({ ...base, myDone: 5, partnerDone: 5, claimed: true }, '2026-11-25')).toBe('claimed');
  });
});

describe('sortDuoQuests', () => {
  test('o que pede ação vem primeiro', () => {
    const list = [
      { ...base, id: 'ativa' },
      { ...base, id: 'convite', status: 'pending' as const, iInvited: false },
      { ...base, id: 'premio', myDone: 5, partnerDone: 5 },
    ];
    expect(sortDuoQuests(list, '2026-11-25').map((q) => q.id)).toEqual(['convite', 'premio', 'ativa']);
  });
});

describe('duoGoalText', () => {
  const label = () => 'Saúde';
  test('com e sem área, nos dois idiomas', () => {
    expect(duoGoalText(5, 'health', label)).toBe('5 missões de Saúde cada um');
    expect(duoGoalText(3, null, label)).toBe('3 missões cada um');
    expect(duoGoalText(5, 'health', () => 'Health', 'en')).toBe('5 Health missions each');
  });
});
