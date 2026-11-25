import { ambusher, ambushGoalText, ambushPhase, ambushProgress, AMBUSHERS, parseAmbush } from './ambush';
import type { Habit } from './schedule';

const daily = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  title: id,
  difficulty: 'easy',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  startDate: '2026-01-01',
  ...extra,
});
const window = (id: string) => ({ ambusher: ambusher(id)!, startDate: '2026-11-25', endDate: '2026-11-26' });
const logged = (entries: [string, string[]][]) => new Map(entries.map(([d, ids]) => [d, new Set(ids)]));

describe('catálogo', () => {
  it('cinco minichefes na ordem do banco, com desafio e prêmio', () => {
    expect(AMBUSHERS.map((a) => a.id)).toEqual(['goblin', 'slime', 'morcego', 'diabrete', 'esqueleto']);
    for (const a of AMBUSHERS) expect(a.reward).toBeGreaterThan(0);
  });
});

describe('progresso do desafio', () => {
  const habits = [
    daily('ler', { category: 'knowledge' }),
    daily('org', { category: 'productivity' }),
    daily('treino', { difficulty: 'hard', category: 'health' }),
  ];

  it('Goblin: missões de qualquer área nos 2 dias', () => {
    const p = ambushProgress(window('goblin'), habits, logged([['2026-11-25', ['ler', 'org']], ['2026-11-26', ['treino']], ['2026-11-27', ['ler']]]));
    expect(p).toEqual({ done: 3, target: 4, complete: false });
  });

  it('Slime: só Produtividade; Esqueleto: só difíceis', () => {
    const l = logged([['2026-11-25', ['org', 'treino']], ['2026-11-26', ['org', 'treino']]]);
    expect(ambushProgress(window('slime'), habits, l)).toEqual({ done: 2, target: 3, complete: false });
    expect(ambushProgress(window('esqueleto'), habits, l)).toEqual({ done: 2, target: 2, complete: true });
  });

  it('Morcego: os dois dias perfeitos', () => {
    const all = ['ler', 'org', 'treino'];
    expect(ambushProgress(window('morcego'), habits, logged([['2026-11-25', all], ['2026-11-26', ['ler']]])).done).toBe(1);
    expect(ambushProgress(window('morcego'), habits, logged([['2026-11-25', all], ['2026-11-26', all]])).complete).toBe(true);
  });
});

describe('fases, textos e leitura', () => {
  it('por vir, em andamento, encerrada', () => {
    const w = window('goblin');
    expect(ambushPhase(w, '2026-11-24')).toBe('upcoming');
    expect(ambushPhase(w, '2026-11-26')).toBe('active');
    expect(ambushPhase(w, '2026-11-27')).toBe('ended');
  });

  it('textos do desafio', () => {
    const label = (c: string) => ({ productivity: 'Produtividade', wellbeing: 'Bem-estar' })[c] ?? c;
    expect(ambushGoalText(ambusher('goblin')!.goal, label)).toBe('4 missões');
    expect(ambushGoalText(ambusher('slime')!.goal, label)).toBe('3 missões de Produtividade');
    expect(ambushGoalText(ambusher('morcego')!.goal, label, 'en')).toBe('2 perfect days');
    expect(ambushGoalText(ambusher('esqueleto')!.goal, label)).toBe('2 missões difíceis');
  });

  it('lê my_ambush', () => {
    expect(parseAmbush(null)).toBeNull();
    expect(parseAmbush({ ambusher: 'x', start_date: '2026-11-25', end_date: '2026-11-26' })).toBeNull();
    expect(parseAmbush({ ambusher: 'slime', start_date: '2026-11-25', end_date: '2026-11-26', claimed: true })).toMatchObject({
      ambusher: { id: 'slime' },
      claimed: true,
    });
  });
});
