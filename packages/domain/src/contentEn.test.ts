import { BOSSES, bossText } from './challenges';
import { BOSS_EN, ITEM_EN, PATH_EN, RACE_EN, TITLE_EN } from './contentEn';
import { HERO_SLOTS, attributeLabel, heroTitle, itemLabel, nextUnlock, slotLabel, unlocksBetween } from './hero';
import { OBJECTIVE_CATEGORIES } from './habits';
import { PATHS, RACES, branchLabel, pathLabel, pathLine, raceLabel, stageName } from './paths';
import { REWARD_SUGGESTIONS, rewardSuggestions } from './rewards';
import { TITLE_IDS, rarityLabel, titleDescription, titleHint, titleName } from './titles';

describe('conteúdo em inglês: cobertura', () => {
  it('toda raça, caminho, título e chefe tem tradução', () => {
    for (const r of RACES) expect(RACE_EN[r]).toBeDefined();
    for (const p of PATHS) expect(PATH_EN[p]).toBeDefined();
    for (const id of TITLE_IDS) expect(TITLE_EN[id]).toBeDefined();
    for (const b of BOSSES) expect(BOSS_EN[b.id]).toBeDefined();
  });

  it('toda peça do herói tem nome em inglês', () => {
    for (const [slot, { items }] of Object.entries(HERO_SLOTS)) {
      for (const item of items) expect([slot, item.id, ITEM_EN[slot]?.[item.id]]).not.toContain(undefined);
    }
  });

  it('sugestões de recompensa têm a mesma quantidade nos dois idiomas', () => {
    expect(rewardSuggestions('en')).toHaveLength(REWARD_SUGGESTIONS.length);
    expect(rewardSuggestions('en')[0]!.title).toBe('Watch an episode of my show');
    expect(rewardSuggestions()).toBe(REWARD_SUGGESTIONS);
  });
});

describe('textos do jogo por idioma', () => {
  it('estágio, caminho e ramo', () => {
    expect(stageName('marcial', 'B', 5, 'feminino')).toBe('Senhora da Guerra');
    expect(stageName('marcial', 'B', 5, 'feminino', 'en')).toBe('Warlady');
    expect(stageName('arcano', null, 0, 'masculino', 'en')).toBe('Apprentice');
    expect(pathLine('espirito', 'B', 'feminino', 'en')).toEqual([
      'Novice',
      'Acolyte',
      'Disciple',
      'Cleric',
      'Priestess',
      'Saint',
    ]);
    expect(pathLabel('oficio', 'en')).toBe('Craft');
    expect(pathLabel('oficio')).toBe('Ofício');
    expect(branchLabel('marcial', 'A', 'en')).toBe('Honor');
    expect(raceLabel('anao', 'feminino')).toBe('Anã');
    expect(raceLabel('anao', 'feminino', 'en')).toBe('Dwarf');
  });

  it('peças, títulos e desbloqueios', () => {
    const blue = HERO_SLOTS.hairColor.items.find((i) => i.id === 'azul')!;
    expect(itemLabel('hairColor', blue, 'en')).toBe('Electric blue');
    expect(itemLabel('hairColor', blue)).toBe('Azul elétrico');
    expect(slotLabel('eyes', 'en')).toBe('Eye color');
    expect(heroTitle(12, 'feminino', 'en')).toBe('Trailblazer');
    expect(heroTitle(12, 'feminino')).toBe('Desbravadora');
    expect(unlocksBetween(4, 5, 'masculino', 'en').map((u) => u.label)).toEqual(
      expect.arrayContaining(['Title: Adventurer', 'Aura: Ember', 'Hair color: Silver']),
    );
    expect(nextUnlock(1, 'masculino', 'en')?.label).toBe('Accessory: Headband');
    expect(attributeLabel('personal_growth', 'en')).toBe('Resolve');
    for (const c of OBJECTIVE_CATEGORIES) expect(attributeLabel(c, 'en')).not.toBe('');
  });

  it('títulos especiais e chefes', () => {
    expect(titleName('lorde-dos-cristais', 'feminino', 'en')).toBe('Crystal Lady');
    expect(titleDescription('centuriao', 'en')).toBe('Completed 100 missions.');
    expect(titleHint('fenix', 'en')).toBe('Sometimes starting over is the greatest victory.');
    expect(titleHint('centuriao', 'en')).toBeUndefined();
    expect(rarityLabel('lendario', 'en')).toBe('Legendary');
    const sombra = BOSSES.find((b) => b.id === 'sombra')!;
    expect(bossText(sombra, 'en').name).toBe('Shadow of Doubt');
    expect(bossText(sombra).name).toBe('Sombra da Dúvida');
  });
});
