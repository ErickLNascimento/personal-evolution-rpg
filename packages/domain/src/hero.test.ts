import { OBJECTIVE_CATEGORIES } from './habits';
import {
  attributeLevel,
  CLASS_CATALOG,
  DEFAULT_HERO,
  HERO_CLASSES,
  ownsClass,
  purchaseStatus,
  heroClassLabel,
  HERO_SLOTS,
  heroAttributes,
  heroTier,
  heroTitle,
  isHeroUnset,
  nextUnlock,
  sanitizeHero,
  unlocksBetween,
  type HeroSlot,
} from './hero';

describe('aparência do herói', () => {
  it('cada peça tem id único e todo slot tem opção no nível 1', () => {
    for (const slot of Object.keys(HERO_SLOTS) as HeroSlot[]) {
      const items = HERO_SLOTS[slot].items;
      expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
      expect(items.some((i) => i.level === 1)).toBe(true);
    }
  });

  it('o padrão só usa peças do nível 1', () => {
    expect(sanitizeHero(DEFAULT_HERO, 1)).toEqual(DEFAULT_HERO);
  });

  it('peça bloqueada ou desconhecida volta ao padrão', () => {
    const raw = { ...DEFAULT_HERO, heroClass: 'mago', aura: 'solar', hair: 'inexistente', hairColor: 'ruivo' };
    expect(sanitizeHero(raw, 4)).toEqual({ ...DEFAULT_HERO, heroClass: 'mago', hairColor: 'ruivo' });
    expect(sanitizeHero(raw, 20).aura).toBe('solar');
  });

  it('aguenta valor salvo malformado', () => {
    expect(sanitizeHero(null, 1)).toEqual(DEFAULT_HERO);
    expect(sanitizeHero({ heroClass: 'dragao' }, 1).heroClass).toBe('guerreiro');
  });

  it('forma feminina é mantida; ausente ou inválida vira masculina', () => {
    expect(sanitizeHero({ ...DEFAULT_HERO, form: 'feminino' }, 1).form).toBe('feminino');
    expect(sanitizeHero({ heroClass: 'mago' }, 1).form).toBe('masculino');
    expect(sanitizeHero({ form: 'outra' }, 1).form).toBe('masculino');
  });

  it('sabe quando o herói ainda não foi criado', () => {
    expect(isHeroUnset({})).toBe(true);
    expect(isHeroUnset(null)).toBe(true);
    expect(isHeroUnset({ heroClass: 'monge' })).toBe(false);
  });
});

describe('classes da loja', () => {
  const none = new Set<string>();

  it('classe paga só vale se comprada', () => {
    expect(sanitizeHero({ ...DEFAULT_HERO, heroClass: 'necromante' }, 30, none).heroClass).toBe('guerreiro');
    expect(sanitizeHero({ ...DEFAULT_HERO, heroClass: 'necromante' }, 30, new Set(['necromante'])).heroClass).toBe('necromante');
    expect(sanitizeHero({ ...DEFAULT_HERO, heroClass: 'monge' }, 1, none).heroClass).toBe('monge');
  });

  it('situação na loja: grátis, possuída, nível, Cristais, comprável', () => {
    expect(purchaseStatus('mago', 1, 0, none)).toBe('free');
    expect(purchaseStatus('bardo', 4, 999, none)).toBe('needs_level');
    expect(purchaseStatus('bardo', 5, 299, none)).toBe('needs_crystals');
    expect(purchaseStatus('bardo', 5, 300, none)).toBe('buyable');
    expect(purchaseStatus('bardo', 1, 0, new Set(['bardo']))).toBe('owned');
    expect(purchaseStatus('necromante', 9, 5000, none)).toBe('needs_level');
  });

  it('toda classe tem catálogo e nome nas duas formas', () => {
    for (const c of HERO_CLASSES) {
      expect(CLASS_CATALOG[c].minLevel).toBeGreaterThanOrEqual(1);
      expect(heroClassLabel(c, 'feminino').length).toBeGreaterThan(0);
    }
    expect(ownsClass('guerreiro', none)).toBe(true);
    expect(ownsClass('druida', none)).toBe(false);
  });
});

describe('concordância de gênero', () => {
  it('classe e título concordam com a forma', () => {
    expect(heroClassLabel('guerreiro', 'feminino')).toBe('Guerreira');
    expect(heroClassLabel('monge', 'feminino')).toBe('Monja');
    expect(heroClassLabel('mago')).toBe('Mago');
    expect(heroTitle(20, 'feminino')).toBe('Campeã');
    expect(heroTitle(1, 'feminino')).toBe('Aprendiz');
    expect(unlocksBetween(4, 5, 'feminino').some((u) => u.label === 'Título: Aventureira')).toBe(true);
  });
});

describe('títulos e desbloqueios', () => {
  it('título e faixa mudam nos marcos de nível', () => {
    expect(heroTitle(1)).toBe('Aprendiz');
    expect(heroTitle(4)).toBe('Aprendiz');
    expect(heroTitle(5)).toBe('Aventureiro');
    expect(heroTitle(31)).toBe('Lenda');
    expect(heroTier(1)).toBe(0);
    expect(heroTier(10)).toBe(2);
  });

  it('lista o que foi liberado ao subir de nível', () => {
    const u = unlocksBetween(4, 5);
    expect(u.map((x) => x.label)).toEqual(
      expect.arrayContaining(['Título: Aventureiro', 'Aura: Brasa', 'Cor do cabelo: Prata']),
    );
    expect(u.every((x) => x.level === 5)).toBe(true);
  });

  it('subir vários níveis de uma vez junta tudo, em ordem', () => {
    const u = unlocksBetween(1, 4);
    expect(u.map((x) => x.level)).toEqual([...u.map((x) => x.level)].sort((a, b) => a - b));
    expect(u.some((x) => x.label === 'Acessório: Capa')).toBe(true);
    expect(unlocksBetween(5, 5)).toEqual([]);
  });

  it('mostra o próximo desbloqueio', () => {
    expect(nextUnlock(1)?.level).toBe(2);
    expect(nextUnlock(19)?.level).toBe(20);
  });
});

describe('atributos', () => {
  it('nível do atributo cresce com a raiz do XP', () => {
    expect(attributeLevel(0)).toEqual({ level: 1, progress: 0 });
    expect(attributeLevel(20).level).toBe(2);
    expect(attributeLevel(80).level).toBe(3);
    expect(attributeLevel(50).progress).toBeCloseTo(0.5);
  });

  it('ficha tem todas as áreas, com zero onde não há XP', () => {
    const ficha = heroAttributes([{ category: 'health', xp: 30 }, { category: 'health', xp: 10 }], OBJECTIVE_CATEGORIES);
    expect(ficha).toHaveLength(OBJECTIVE_CATEGORIES.length);
    expect(ficha.find((a) => a.category === 'health')).toMatchObject({ label: 'Vigor', xp: 40, level: 2 });
    expect(ficha.find((a) => a.category === 'finance')?.xp).toBe(0);
  });
});
