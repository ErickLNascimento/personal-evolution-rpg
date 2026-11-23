import { OBJECTIVE_CATEGORIES } from './habits';
import {
  eligibleTier,
  flashBonusXp,
  flashRemainingMs,
  formatRemaining,
  heroLook,
  isPathId,
  isRace,
  PATHS,
  PATH_INFO,
  pathChangeAvailableAt,
  pathForArea,
  pathLine,
  promotionStatus,
  stageName,
  suggestPath,
  STAGE_RULES,
  visualClass,
  visualKit,
} from './paths';

describe('caminhos', () => {
  it('cada área de vida pertence a exatamente um caminho', () => {
    for (const area of OBJECTIVE_CATEGORIES) {
      const owners = PATHS.filter((p) => PATH_INFO[p].areas.includes(area));
      expect(owners).toHaveLength(1);
    }
    expect(pathForArea('career')).toBe('oficio');
    expect(pathForArea('finance')).toBe('oficio');
    expect(pathForArea('health')).toBe('marcial');
  });

  it('valida ids', () => {
    expect(isPathId('marcial')).toBe(true);
    expect(isPathId('pirata')).toBe(false);
    expect(isRace('elfo')).toBe(true);
    expect(isRace('vampiro')).toBe(false);
  });
});

describe('estágios', () => {
  it('requisitos crescem a cada estágio', () => {
    for (let i = 1; i < STAGE_RULES.length; i++) {
      expect(STAGE_RULES[i]!.minLevel).toBeGreaterThan(STAGE_RULES[i - 1]!.minLevel);
      expect(STAGE_RULES[i]!.minMissions).toBeGreaterThan(STAGE_RULES[i - 1]!.minMissions);
    }
  });

  it('o estágio depende de nível E de missões na área', () => {
    expect(eligibleTier(1, 0)).toBe(0);
    expect(eligibleTier(5, 9)).toBe(0);
    expect(eligibleTier(5, 10)).toBe(1);
    expect(eligibleTier(100, 10)).toBe(1); // nível alto não basta
    expect(eligibleTier(9, 500)).toBe(1); // missões demais também não
    expect(eligibleTier(20, 120)).toBe(3);
    expect(eligibleTier(40, 500)).toBe(5);
  });

  it('nomes por forma, tronco e ramo', () => {
    expect(stageName('marcial', null, 0)).toBe('Aventureiro');
    expect(stageName('marcial', null, 2, 'feminino')).toBe('Guerreira');
    expect(stageName('marcial', 'A', 3)).toBe('Cavaleiro');
    expect(stageName('marcial', 'B', 5, 'feminino')).toBe('Senhora da Guerra');
    expect(stageName('marcial', null, 4)).toBe('Guerreiro'); // sem ramo, fica no último do tronco
    expect(pathLine('arcano', 'B')).toEqual([
      'Aprendiz',
      'Iniciado',
      'Mago',
      'Ocultista',
      'Necromante',
      'Senhor das Almas',
    ]);
  });
});

describe('promoção', () => {
  it('mostra o que falta', () => {
    const s = promotionStatus({ path: 'marcial', branch: null, stage: 0 }, 3, 4);
    expect(s.next?.tier).toBe(1);
    expect(s.ready).toBe(false);
    expect(s.missingLevels).toBe(2);
    expect(s.missingMissions).toBe(6);
  });

  it('pede o ramo na promoção para o estágio 3', () => {
    const s = promotionStatus({ path: 'arcano', branch: null, stage: 2 }, 20, 120);
    expect(s.ready).toBe(true);
    expect(s.needsBranch).toBe(true);
    expect(promotionStatus({ path: 'arcano', branch: 'A', stage: 2 }, 20, 120).needsBranch).toBe(
      false,
    );
  });

  it('sem caminho ou no estágio máximo não há promoção', () => {
    expect(promotionStatus({ path: null, branch: null, stage: 0 }, 50, 999).ready).toBe(false);
    const max = promotionStatus({ path: 'marcial', branch: 'A', stage: 5 }, 100, 999);
    expect(max.next).toBeNull();
    expect(max.ready).toBe(false);
  });
});

describe('troca de caminho', () => {
  it('espera de 14 dias', () => {
    const changed = new Date('2026-11-01T12:00:00Z');
    expect(pathChangeAvailableAt(null, new Date())).toBeNull();
    expect(pathChangeAvailableAt(changed, new Date('2026-11-10T12:00:00Z'))?.toISOString()).toBe(
      '2026-11-15T12:00:00.000Z',
    );
    expect(pathChangeAvailableAt(changed, new Date('2026-11-15T12:00:01Z'))).toBeNull();
  });
});

describe('desenho por estágio', () => {
  it('reaproveita as classes antigas', () => {
    expect(visualClass('marcial', null, 0)).toBe('guerreiro');
    expect(visualClass('marcial', 'A', 3)).toBe('paladino');
    expect(visualClass('marcial', 'B', 3)).toBe('guerreiro'); // Bárbaro usa o corpo do guerreiro
    expect(visualKit('marcial', 'B', 3)).toBe('barbaro');
    expect(visualKit('oficio', null, 0)).toBe('artesao');
    expect(visualKit('natureza', 'B', 5)).toBe('metamorfo');
    expect(visualClass('marcial', 'A', 2)).toBe('guerreiro'); // o ramo só aparece a partir do 3
    expect(visualClass('arcano', 'B', 4)).toBe('necromante');
    expect(visualClass('espirito', 'B', 3)).toBe('paladino'); // Clérigo usa o corpo do paladino
    expect(visualClass(null, null, 0)).toBe('guerreiro');
  });
});

describe('missão relâmpago', () => {
  it('bônus de 50% arredondado para cima', () => {
    expect(flashBonusXp(20)).toBe(10);
    expect(flashBonusXp(15)).toBe(8);
  });

  it('tempo restante', () => {
    const now = new Date('2026-11-24T10:00:00Z');
    expect(flashRemainingMs(new Date('2026-11-24T09:00:00Z'), now)).toBe(0);
    expect(formatRemaining(flashRemainingMs(new Date('2026-11-24T13:12:00Z'), now))).toBe(
      '3h 12min',
    );
    expect(formatRemaining(45 * 60000)).toBe('45min');
    expect(formatRemaining(20000)).toBe('menos de 1min');
  });
});

describe('aparência pelo caminho', () => {
  it('a classe desenhada vem do caminho, não do que foi salvo', () => {
    const saved = { heroClass: 'necromante', form: 'feminino', hairColor: 'ruivo' };
    const look = heroLook(saved, 3, { path: 'cancao', branch: null, stage: 0 });
    expect(look.heroClass).toBe('bardo');
    expect(look.kit).toBe('bardo');
    expect(look.tier).toBe(0);
    expect(look.race).toBe('humano');
    expect(look.form).toBe('feminino');
    expect(look.hairColor).toBe('ruivo');
  });

  it('sugere o caminho da primeira área escolhida', () => {
    expect(suggestPath(['finance', 'health'])).toBe('oficio');
    expect(suggestPath([])).toBe('marcial');
  });
});
