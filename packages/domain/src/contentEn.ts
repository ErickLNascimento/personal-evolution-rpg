/**
 * Conteúdo do jogo em inglês: raças, caminhos, peças do herói, títulos, chefes e sugestões.
 * O português continua nos módulos de origem (fonte); aqui ficam só as traduções, pelas mesmas
 * chaves. As funções que mostram esses textos (stageName, titleName, bossText…) recebem `locale`.
 * Pares [masculino, feminino]: em inglês quase sempre iguais.
 */
import type { ObjectiveCategory } from './habits';

type Name = readonly [string, string];
const same = (n: string): Name => [n, n];

export const RACE_EN: Record<string, { label: Name; description: string }> = {
  humano: { label: same('Human'), description: 'Versatile, from every corner of the world.' },
  elfo: { label: same('Elf'), description: 'Pointed ears and a watchful gaze.' },
  anao: { label: same('Dwarf'), description: 'Short, sturdy and stubborn as stone.' },
  orc: { label: same('Orc'), description: 'Tusks, strength and a loyal heart.' },
  halfling: { label: same('Halfling'), description: 'Small, nimble and barefoot.' },
  draconato: { label: same('Dragonborn'), description: 'Dragon scales and horns.' },
};

export interface PathEn {
  label: string;
  motto: string;
  trunk: readonly [Name, Name, Name];
  branches: Record<'A' | 'B', { label: string; stages: readonly [Name, Name, Name] }>;
}

export const PATH_EN: Record<string, PathEn> = {
  marcial: {
    label: 'Martial',
    motto: 'Discipline forged every day.',
    trunk: [same('Adventurer'), same('Fighter'), same('Warrior')],
    branches: {
      A: {
        label: 'Honor',
        stages: [same('Knight'), same('Paladin'), same('Holy Champion')],
      },
      B: {
        label: 'Fury',
        stages: [same('Barbarian'), same('Berserker'), ['Warlord', 'Warlady']],
      },
    },
  },
  arcano: {
    label: 'Arcane',
    motto: 'Knowledge is the greatest power.',
    trunk: [same('Apprentice'), same('Initiate'), same('Mage')],
    branches: {
      A: {
        label: 'Pure arcana',
        stages: [same('Sorcerer'), same('Archmage'), same('Supreme Sage')],
      },
      B: {
        label: 'Occultism',
        stages: [same('Occultist'), same('Necromancer'), ['Lord of Souls', 'Lady of Souls']],
      },
    },
  },
  destreza: {
    label: 'Dexterity',
    motto: 'Eyes on the target, one step at a time.',
    trunk: [same('Scout'), same('Explorer'), ['Huntsman', 'Huntress']],
    branches: {
      A: {
        label: 'Aim',
        stages: [same('Archer'), same('Ranger'), same('Hawkeye')],
      },
      B: {
        label: 'Shadow',
        stages: [same('Rogue'), same('Shade'), ['Shadowmaster', 'Shadowmistress']],
      },
    },
  },
  espirito: {
    label: 'Spirit',
    motto: 'Balance between body and mind.',
    trunk: [same('Novice'), same('Acolyte'), same('Disciple')],
    branches: {
      A: {
        label: 'Discipline',
        stages: [same('Monk'), same('Zen Master'), same('Enlightened')],
      },
      B: {
        label: 'Faith',
        stages: [same('Cleric'), ['Priest', 'Priestess'], same('Saint')],
      },
    },
  },
  natureza: {
    label: 'Nature',
    motto: 'Those who tend their roots will grow.',
    trunk: [same('Wanderer'), same('Herbalist'), same('Druid')],
    branches: {
      A: {
        label: 'Spirits',
        stages: [same('Shaman'), same('Archdruid'), same('Avatar of Nature')],
      },
      B: {
        label: 'Beast',
        stages: [same('Shapeshifter'), same('Wild Guardian'), same('Forest Spirit')],
      },
    },
  },
  cancao: {
    label: 'Song',
    motto: 'Every bond becomes a song.',
    trunk: [same('Minstrel'), same('Troubadour'), same('Bard')],
    branches: {
      A: {
        label: 'Lore',
        stages: [same('Chronicler'), same('Master Storyteller'), same('Voice of the Ages')],
      },
      B: {
        label: 'Valor',
        stages: [same('Skald'), same('War Herald'), same('Epic Legend')],
      },
    },
  },
  oficio: {
    label: 'Craft',
    motto: 'Steady hands build tomorrow.',
    trunk: [same('Craft Apprentice'), same('Artisan'), same('Artificer')],
    branches: {
      A: {
        label: 'Invention',
        stages: [same('Inventor'), same('Arcane Engineer'), same('Grand Artificer')],
      },
      B: {
        label: 'Trade',
        stages: [same('Merchant'), same('Guildmaster'), ['Trade Baron', 'Trade Baroness']],
      },
    },
  },
};

export const FORM_EN: Record<string, string> = { masculino: 'Male', feminino: 'Female' };

export const SLOT_EN: Record<string, string> = {
  skin: 'Skin tone',
  eyes: 'Eye color',
  hair: 'Hair',
  hairColor: 'Hair color',
  outfit: 'Outfit color',
  aura: 'Aura',
  accessory: 'Accessory',
};

/** Peças do herói por espaço (o mesmo id pode ter nomes diferentes em espaços diferentes). */
export const ITEM_EN: Record<string, Record<string, string>> = {
  skin: {
    pele1: 'Tone 1',
    pele2: 'Tone 2',
    pele3: 'Tone 3',
    pele4: 'Tone 4',
    pele5: 'Tone 5',
    pele6: 'Tone 6',
    'verde-claro': 'Light green',
    verde: 'Green',
    cinza: 'Gray',
    'escama-vermelha': 'Red scales',
    'escama-azul': 'Blue scales',
    'escama-dourada': 'Golden scales',
  },
  hair: {
    curto: 'Short',
    longo: 'Long',
    raspado: 'Shaved',
    moicano: 'Mohawk',
    coque: 'Bun',
    espetado: 'Spiky',
    tranca: 'Braid',
  },
  hairColor: {
    preto: 'Black',
    castanho: 'Brown',
    loiro: 'Blond',
    ruivo: 'Red',
    prata: 'Silver',
    azul: 'Electric blue',
    violeta: 'Violet',
    'loja-cabelo-rosa': 'Bubblegum pink',
    'loja-cabelo-menta': 'Mint',
    'loja-cabelo-fogo': 'Fire',
    'loja-cabelo-neve': 'Snow',
  },
  eyes: {
    castanho: 'Brown',
    azul: 'Blue',
    verde: 'Green',
    ambar: 'Amber',
    violeta: 'Violet',
    carmesim: 'Crimson',
    dourado: 'Golden',
  },
  outfit: {
    carmesim: 'Crimson',
    anil: 'Indigo',
    floresta: 'Forest',
    ametista: 'Amethyst',
    obsidiana: 'Obsidian',
    aurora: 'Aurora',
    ouro: 'Royal gold',
    'loja-roupa-marfim': 'Ivory',
    'loja-roupa-vinho': 'Wine',
    'loja-roupa-celeste': 'Sky blue',
    'loja-roupa-grafite': 'Graphite',
  },
  aura: {
    nenhuma: 'None',
    brasa: 'Ember',
    mare: 'Tide',
    relampago: 'Lightning',
    eclipse: 'Eclipse',
    solar: 'Solar',
    'loja-aura-gelo': 'Eternal ice',
    'loja-aura-rubi': 'Ruby',
    'loja-aura-esmeralda': 'Emerald',
    'loja-aura-sakura': 'Sakura',
    'loja-aura-sombra': 'Shadow',
  },
  accessory: {
    nenhum: 'None',
    faixa: 'Headband',
    capa: 'Cape',
    elmo: 'Helm',
    coroa: 'Crown',
  },
};

export const ATTRIBUTE_EN: Record<ObjectiveCategory, string> = {
  health: 'Vigor',
  wellbeing: 'Spirit',
  knowledge: 'Wisdom',
  career: 'Craft',
  productivity: 'Focus',
  finance: 'Fortune',
  relationships: 'Charisma',
  personal_growth: 'Resolve',
};

export const RARITY_EN: Record<string, string> = {
  comum: 'Common',
  raro: 'Rare',
  epico: 'Epic',
  lendario: 'Legendary',
};

export const TITLE_EN: Record<string, { name: Name; description: string; hint?: string }> = {
  'nivel-1': { name: same('Apprentice'), description: 'Level 1.' },
  'nivel-5': { name: same('Adventurer'), description: 'Reached level 5.' },
  'nivel-10': { name: same('Trailblazer'), description: 'Reached level 10.' },
  'nivel-15': { name: same('Veteran'), description: 'Reached level 15.' },
  'nivel-20': { name: same('Champion'), description: 'Reached level 20.' },
  'nivel-30': { name: same('Legend'), description: 'Reached level 30.' },
  'primeiro-passo': { name: same('First Step'), description: 'Completed your first mission.' },
  centuriao: { name: same('Centurion'), description: 'Completed 100 missions.' },
  'mestre-das-manhas': {
    name: ['Master of Mornings', 'Mistress of Mornings'],
    description: 'Completed 10 missions before 8 AM.',
  },
  'lorde-dos-cristais': {
    name: ['Crystal Lord', 'Crystal Lady'],
    description: 'Earned 1,000 Crystals in total.',
  },
  inabalavel: { name: same('Unshakable'), description: 'Completed 30 perfect days.' },
  fenix: {
    name: same('Phoenix'),
    description: 'Came back with a perfect day after 7 days away.',
    hint: 'Sometimes starting over is the greatest victory.',
  },
  'equilibrio-perfeito': {
    name: same('Perfect Balance'),
    description: 'Had a perfect day with missions from 4 different areas.',
    hint: 'A day when no part of life was forgotten.',
  },
  'conquista-health': { name: same('Forged Body'), description: 'Achieved a Health goal.' },
  'conquista-knowledge': { name: same('Awakened Mind'), description: 'Achieved a Knowledge goal.' },
  'conquista-career': { name: same('Master Artisan'), description: 'Achieved a Career goal.' },
  'conquista-finance': { name: same('Treasure Keeper'), description: 'Achieved a Finance goal.' },
  'conquista-productivity': {
    name: same('Blade of Focus'),
    description: 'Achieved a Productivity goal.',
  },
  'conquista-relationships': {
    name: same('Unbreakable Bond'),
    description: 'Achieved a Relationships goal.',
  },
  'conquista-wellbeing': { name: same('Serene Soul'), description: 'Achieved a Well-being goal.' },
  'conquista-personal_growth': {
    name: same('Reborn'),
    description: 'Achieved a Personal growth goal.',
  },
};

export const BOSS_EN: Record<string, { name: string; taunt: string }> = {
  golem: { name: 'Golem of Sloth', taunt: 'Stay in bed five more minutes...' },
  hidra: { name: 'Hydra of Distraction', taunt: 'Just one more video. And another. And another.' },
  lich: { name: 'Lich of Procrastination', taunt: 'Tomorrow is a better day to start.' },
  dragao: { name: 'Dragon of Fatigue', taunt: 'You deserve to skip today.' },
  sombra: { name: 'Shadow of Doubt', taunt: "Why even try? It won't work." },
  basilisco: { name: 'Screen Basilisk', taunt: 'Look at me. Just one more scroll.' },
};

/** Sugestões de recompensa, na mesma ordem das em português. */
export const REWARD_SUGGESTIONS_EN: readonly string[] = [
  'Watch an episode of my show',
  'A guilt-free treat',
  '1 hour of video games',
  'Order takeout on the weekend',
];
