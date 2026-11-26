import { DEFAULT_HERO, findItem, isUnlocked, sanitizeHero, SHOP_COSMETICS } from './hero';
import { affordable, REWARD_PRICE_MAX, REWARD_SUGGESTIONS, validateReward } from './rewards';

describe('recompensas personalizadas', () => {
  it('valida nome e preço', () => {
    expect(validateReward({ title: '  ', price: 50 })).not.toBeNull();
    expect(validateReward({ title: 'Ver um filme', price: 4 })).not.toBeNull();
    expect(validateReward({ title: 'Ver um filme', price: REWARD_PRICE_MAX + 1 })).not.toBeNull();
    expect(validateReward({ title: 'Ver um filme', price: 12.5 })).not.toBeNull();
    expect(validateReward({ title: 'Ver um filme', price: 50, emoji: '🎬' })).toBeNull();
  });

  it('sugestões são válidas', () => {
    for (const s of REWARD_SUGGESTIONS) expect(validateReward(s)).toBeNull();
  });

  it('quantas vezes dá para resgatar', () => {
    expect(affordable(50, 49)).toBe(0);
    expect(affordable(50, 120)).toBe(2);
  });
});

describe('cosméticos da loja', () => {
  it('a loja tem auras, roupas e cabelos com preço', () => {
    const slots = new Set(SHOP_COSMETICS.map((c) => c.slot));
    expect(slots).toEqual(new Set(['aura', 'outfit', 'hairColor']));
    for (const c of SHOP_COSMETICS) expect(c.item.price).toBeGreaterThan(0);
    const ids = SHOP_COSMETICS.map((c) => c.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('item da loja só vale se comprado, em qualquer nível', () => {
    const gelo = findItem('aura', 'loja-aura-gelo')!;
    expect(isUnlocked(gelo, 100)).toBe(false);
    expect(isUnlocked(gelo, 1, new Set(['loja-aura-gelo']))).toBe(true);
    const saved = { ...DEFAULT_HERO, aura: 'loja-aura-gelo' };
    expect(sanitizeHero(saved, 50).aura).toBe('nenhuma');
    expect(sanitizeHero(saved, 1, new Set(['loja-aura-gelo'])).aura).toBe('loja-aura-gelo');
  });
});

describe('validateReward em inglês', () => {
  test('a mensagem segue o idioma', () => {
    expect(validateReward({ title: '', price: 50 }, 'en')).toBe('Give the reward a name.');
    expect(validateReward({ title: '', price: 50 })).toBe('Dê um nome para a recompensa.');
  });
});
