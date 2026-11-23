/**
 * Evolução do herói: raça (só visual), caminho, ramo e estágio (docs/design/evolucao-do-heroi.md).
 * Espelha `path_catalog`, `path_stage_rules` e `path_perks` do banco, que é a fonte de verdade:
 * quem promove e troca de caminho são as funções `promote_hero` e `choose_path`.
 * Aqui ficam os nomes, os textos e as contas que a tela mostra antes de chamar o banco.
 */
import { HERO_CLASSES, sanitizeHero, type HeroClass, type HeroForm, type HeroLook } from './hero';
import type { ObjectiveCategory } from './habits';

// ─────────────────────────────────────────────────────────────
// Raças
// ─────────────────────────────────────────────────────────────
export const RACES = ['humano', 'elfo', 'anao', 'orc', 'halfling', 'draconato'] as const;
export type Race = (typeof RACES)[number];

export const RACE_INFO: Record<Race, { label: Record<HeroForm, string>; description: string }> = {
  humano: {
    label: { masculino: 'Humano', feminino: 'Humana' },
    description: 'Versátil, de todos os cantos do mundo.',
  },
  elfo: {
    label: { masculino: 'Elfo', feminino: 'Elfa' },
    description: 'Orelhas pontudas e olhar atento.',
  },
  anao: {
    label: { masculino: 'Anão', feminino: 'Anã' },
    description: 'Baixo, robusto e teimoso como pedra.',
  },
  orc: {
    label: { masculino: 'Orc', feminino: 'Orc' },
    description: 'Presas, força e coração leal.',
  },
  halfling: {
    label: { masculino: 'Halfling', feminino: 'Halfling' },
    description: 'Pequeno, ágil e de pés descalços.',
  },
  draconato: {
    label: { masculino: 'Draconato', feminino: 'Draconata' },
    description: 'Escamas e chifres de dragão.',
  },
};

export function isRace(value: unknown): value is Race {
  return typeof value === 'string' && (RACES as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────
// Caminhos, estágios e ramos
// ─────────────────────────────────────────────────────────────
export const PATHS = [
  'marcial',
  'arcano',
  'destreza',
  'espirito',
  'natureza',
  'cancao',
  'oficio',
] as const;
export type PathId = (typeof PATHS)[number];
export type Branch = 'A' | 'B';
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

/** Primeiro estágio em que o caminho se divide em ramos. */
export const BRANCH_TIER = 3;
export const MAX_TIER: Tier = 5;
/** Espera entre trocas de caminho ou de ramo (igual a `path_change_cooldown()`). */
export const PATH_CHANGE_COOLDOWN_DAYS = 14;

/** [masculino, feminino] */
type Name = readonly [string, string];

interface PathInfo {
  label: string;
  areas: readonly ObjectiveCategory[];
  motto: string;
  /** Estágios 0, 1 e 2 (antes da bifurcação). */
  trunk: readonly [Name, Name, Name];
  /** Estágios 3, 4 e 5 de cada ramo. */
  branches: Record<Branch, { label: string; stages: readonly [Name, Name, Name] }>;
}

export const PATH_INFO: Record<PathId, PathInfo> = {
  marcial: {
    label: 'Marcial',
    areas: ['health'],
    motto: 'Disciplina forjada todo dia.',
    trunk: [
      ['Aventureiro', 'Aventureira'],
      ['Lutador', 'Lutadora'],
      ['Guerreiro', 'Guerreira'],
    ],
    branches: {
      A: {
        label: 'Honra',
        stages: [
          ['Cavaleiro', 'Cavaleira'],
          ['Paladino', 'Paladina'],
          ['Campeão Sagrado', 'Campeã Sagrada'],
        ],
      },
      B: {
        label: 'Fúria',
        stages: [
          ['Bárbaro', 'Bárbara'],
          ['Berserker', 'Berserker'],
          ['Senhor da Guerra', 'Senhora da Guerra'],
        ],
      },
    },
  },
  arcano: {
    label: 'Arcano',
    areas: ['knowledge'],
    motto: 'Conhecimento é o maior poder.',
    trunk: [
      ['Aprendiz', 'Aprendiz'],
      ['Iniciado', 'Iniciada'],
      ['Mago', 'Maga'],
    ],
    branches: {
      A: {
        label: 'Arcano puro',
        stages: [
          ['Feiticeiro', 'Feiticeira'],
          ['Arquimago', 'Arquimaga'],
          ['Sábio Supremo', 'Sábia Suprema'],
        ],
      },
      B: {
        label: 'Ocultismo',
        stages: [
          ['Ocultista', 'Ocultista'],
          ['Necromante', 'Necromante'],
          ['Senhor das Almas', 'Senhora das Almas'],
        ],
      },
    },
  },
  destreza: {
    label: 'Destreza',
    areas: ['productivity'],
    motto: 'Foco no alvo, um passo por vez.',
    trunk: [
      ['Batedor', 'Batedora'],
      ['Explorador', 'Exploradora'],
      ['Caçador', 'Caçadora'],
    ],
    branches: {
      A: {
        label: 'Mira',
        stages: [
          ['Arqueiro', 'Arqueira'],
          ['Patrulheiro', 'Patrulheira'],
          ['Olho de Falcão', 'Olho de Falcão'],
        ],
      },
      B: {
        label: 'Sombra',
        stages: [
          ['Ladino', 'Ladina'],
          ['Sombra', 'Sombra'],
          ['Mestre das Sombras', 'Mestra das Sombras'],
        ],
      },
    },
  },
  espirito: {
    label: 'Espírito',
    areas: ['wellbeing'],
    motto: 'Equilíbrio entre corpo e mente.',
    trunk: [
      ['Noviço', 'Noviça'],
      ['Acólito', 'Acólita'],
      ['Discípulo', 'Discípula'],
    ],
    branches: {
      A: {
        label: 'Disciplina',
        stages: [
          ['Monge', 'Monja'],
          ['Mestre Zen', 'Mestra Zen'],
          ['Iluminado', 'Iluminada'],
        ],
      },
      B: {
        label: 'Fé',
        stages: [
          ['Clérigo', 'Clériga'],
          ['Sacerdote', 'Sacerdotisa'],
          ['Santo', 'Santa'],
        ],
      },
    },
  },
  natureza: {
    label: 'Natureza',
    areas: ['personal_growth'],
    motto: 'Cresce quem cuida das raízes.',
    trunk: [
      ['Andarilho', 'Andarilha'],
      ['Herbalista', 'Herbalista'],
      ['Druida', 'Druida'],
    ],
    branches: {
      A: {
        label: 'Espíritos',
        stages: [
          ['Xamã', 'Xamã'],
          ['Arquidruida', 'Arquidruida'],
          ['Avatar da Natureza', 'Avatar da Natureza'],
        ],
      },
      B: {
        label: 'Fera',
        stages: [
          ['Metamorfo', 'Metamorfa'],
          ['Guardião Selvagem', 'Guardiã Selvagem'],
          ['Espírito da Floresta', 'Espírito da Floresta'],
        ],
      },
    },
  },
  cancao: {
    label: 'Canção',
    areas: ['relationships'],
    motto: 'Cada laço vira uma canção.',
    trunk: [
      ['Menestrel', 'Menestrel'],
      ['Trovador', 'Trovadora'],
      ['Bardo', 'Barda'],
    ],
    branches: {
      A: {
        label: 'Saber',
        stages: [
          ['Cronista', 'Cronista'],
          ['Mestre das Histórias', 'Mestra das Histórias'],
          ['Voz das Eras', 'Voz das Eras'],
        ],
      },
      B: {
        label: 'Valor',
        stages: [
          ['Skald', 'Skald'],
          ['Arauto de Guerra', 'Arauta de Guerra'],
          ['Lenda Épica', 'Lenda Épica'],
        ],
      },
    },
  },
  oficio: {
    label: 'Ofício',
    areas: ['career', 'finance'],
    motto: 'Mãos firmes constroem o amanhã.',
    trunk: [
      ['Aprendiz de Ofício', 'Aprendiz de Ofício'],
      ['Artesão', 'Artesã'],
      ['Artífice', 'Artífice'],
    ],
    branches: {
      A: {
        label: 'Invenção',
        stages: [
          ['Inventor', 'Inventora'],
          ['Engenheiro Arcano', 'Engenheira Arcana'],
          ['Grão-Artífice', 'Grã-Artífice'],
        ],
      },
      B: {
        label: 'Comércio',
        stages: [
          ['Mercador', 'Mercadora'],
          ['Mestre da Guilda', 'Mestra da Guilda'],
          ['Barão do Comércio', 'Baronesa do Comércio'],
        ],
      },
    },
  },
};

export function isPathId(value: unknown): value is PathId {
  return typeof value === 'string' && (PATHS as readonly string[]).includes(value);
}

/** Caminho sugerido no onboarding: o da primeira área escolhida (Marcial se nenhuma). */
export function suggestPath(areas: readonly ObjectiveCategory[]): PathId {
  return areas.length > 0 ? pathForArea(areas[0]!) : 'marcial';
}

/** Caminho de cada área de vida (cada área pertence a exatamente um caminho). */
export function pathForArea(area: ObjectiveCategory): PathId {
  return PATHS.find((p) => PATH_INFO[p].areas.includes(area)) ?? 'natureza';
}

// ─────────────────────────────────────────────────────────────
// Requisitos (espelham `path_stage_rules`)
// ─────────────────────────────────────────────────────────────
export interface StageRule {
  tier: Tier;
  minLevel: number;
  /** Missões concluídas nas áreas do caminho. */
  minMissions: number;
  /** Cristais extras (%) nas missões das áreas do caminho. */
  areaPct: number;
}

export const STAGE_RULES: readonly StageRule[] = [
  { tier: 0, minLevel: 1, minMissions: 0, areaPct: 5 },
  { tier: 1, minLevel: 5, minMissions: 10, areaPct: 7 },
  { tier: 2, minLevel: 10, minMissions: 40, areaPct: 10 },
  { tier: 3, minLevel: 20, minMissions: 120, areaPct: 12 },
  { tier: 4, minLevel: 30, minMissions: 300, areaPct: 15 },
  { tier: 5, minLevel: 40, minMissions: 500, areaPct: 20 },
];

/** Maior estágio que nível e missões permitem (igual a `eligible_tier`). */
export function eligibleTier(level: number, areaMissions: number): Tier {
  let tier: Tier = 0;
  for (const r of STAGE_RULES)
    if (level >= r.minLevel && areaMissions >= r.minMissions) tier = r.tier;
  return tier;
}

export interface HeroPathState {
  path: PathId | null;
  branch: Branch | null;
  stage: Tier;
}

/** Herói que ainda não escolheu caminho. */
export const NO_PATH: HeroPathState = { path: null, branch: null, stage: 0 };

/** Nome da classe no estágio (ex.: "Cavaleira"). Sem ramo a partir do 3, usa o último do tronco. */
export function stageName(
  path: PathId,
  branch: Branch | null,
  stage: Tier,
  form: HeroForm = 'masculino',
): string {
  const info = PATH_INFO[path];
  const i = form === 'feminino' ? 1 : 0;
  if (stage < BRANCH_TIER || !branch) return info.trunk[Math.min(stage, 2)]![i];
  return info.branches[branch].stages[stage - BRANCH_TIER]![i];
}

/** Linha completa de um ramo, do estágio 0 ao 5 (para a tela da árvore). */
export function pathLine(path: PathId, branch: Branch, form: HeroForm = 'masculino'): string[] {
  return ([0, 1, 2, 3, 4, 5] as Tier[]).map((t) => stageName(path, branch, t, form));
}

export interface PromotionStatus {
  /** Próximo estágio, ou null no estágio máximo. */
  next: StageRule | null;
  /** Nível e missões já permitem a promoção. */
  ready: boolean;
  /** A promoção para o próximo estágio exige escolher o ramo. */
  needsBranch: boolean;
  /** Quanto falta (0 quando já atingiu). */
  missingLevels: number;
  missingMissions: number;
}

export function promotionStatus(
  state: HeroPathState,
  level: number,
  areaMissions: number,
): PromotionStatus {
  const next = STAGE_RULES.find((r) => r.tier === state.stage + 1) ?? null;
  if (!state.path || !next) {
    return { next, ready: false, needsBranch: false, missingLevels: 0, missingMissions: 0 };
  }
  const missingLevels = Math.max(0, next.minLevel - level);
  const missingMissions = Math.max(0, next.minMissions - areaMissions);
  return {
    next,
    ready: missingLevels === 0 && missingMissions === 0,
    needsBranch: next.tier === BRANCH_TIER && !state.branch,
    missingLevels,
    missingMissions,
  };
}

/** Quando a próxima troca de caminho ou ramo fica liberada (null = já liberada). */
export function pathChangeAvailableAt(changedAt: Date | null, now: Date): Date | null {
  if (!changedAt) return null;
  const at = new Date(changedAt.getTime() + PATH_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  return at > now ? at : null;
}

/** Visual de um estágio: as 9 classes antigas e os kits novos dos ramos. */
export const VISUAL_KITS = [
  ...HERO_CLASSES,
  'barbaro',
  'feiticeiro',
  'clerigo',
  'xama',
  'metamorfo',
  'cronista',
  'skald',
  'artesao',
  'inventor',
  'mercador',
] as const;
export type VisualKit = (typeof VISUAL_KITS)[number];

/** Corpo (classe de base) que cada kit novo reaproveita. */
const KIT_BODY: Record<Exclude<VisualKit, HeroClass>, HeroClass> = {
  barbaro: 'guerreiro',
  feiticeiro: 'mago',
  clerigo: 'paladino',
  xama: 'druida',
  metamorfo: 'druida',
  cronista: 'bardo',
  skald: 'bardo',
  artesao: 'arqueiro',
  inventor: 'arqueiro',
  mercador: 'bardo',
};

export function kitBody(kit: VisualKit): HeroClass {
  return (HERO_CLASSES as readonly string[]).includes(kit)
    ? (kit as HeroClass)
    : KIT_BODY[kit as Exclude<VisualKit, HeroClass>];
}

/** Visual de cada estágio: tronco com o kit do caminho; a partir do 3, o kit do ramo. */
export function visualKit(path: PathId | null, branch: Branch | null, stage: Tier): VisualKit {
  const late = stage >= BRANCH_TIER && branch !== null;
  const pick = (trunk: VisualKit, a: VisualKit, b: VisualKit) =>
    !late ? trunk : branch === 'A' ? a : b;
  switch (path) {
    case 'marcial':
      return pick('guerreiro', 'paladino', 'barbaro');
    case 'arcano':
      return pick('mago', 'feiticeiro', 'necromante');
    case 'destreza':
      return pick('arqueiro', 'arqueiro', 'ladino');
    case 'espirito':
      return pick('monge', 'monge', 'clerigo');
    case 'natureza':
      return pick('druida', 'xama', 'metamorfo');
    case 'cancao':
      return pick('bardo', 'cronista', 'skald');
    case 'oficio':
      return pick('artesao', 'inventor', 'mercador');
    default:
      return 'guerreiro';
  }
}

/** Aparência no estágio dado (para miniaturas de caminhos e ramos). */
export function lookAtStage(
  look: HeroLook,
  path: PathId,
  branch: Branch | null,
  stage: Tier,
): HeroLook {
  const kit = visualKit(path, branch, stage);
  return { ...look, heroClass: kitBody(kit), kit, tier: stage };
}

/** Classe de base desenhada no estágio (o corpo do kit). */
export function visualClass(path: PathId | null, branch: Branch | null, stage: Tier): HeroClass {
  return kitBody(visualKit(path, branch, stage));
}

/**
 * Aparência do herói para desenhar: as peças salvas (limitadas ao nível) e a classe que vem
 * do caminho e do estágio, não mais de uma escolha livre ou compra.
 */
export function heroLook(
  raw: unknown,
  level: number,
  state: HeroPathState,
  race: Race = 'humano',
): HeroLook {
  const look = sanitizeHero(raw, level, new Set(HERO_CLASSES));
  return { ...lookAtStage(look, state.path ?? 'marcial', state.branch, state.stage), race };
}

// ─────────────────────────────────────────────────────────────
// Missão relâmpago (espelha `my_flash_mission` e o bônus em `log_habit`)
// ─────────────────────────────────────────────────────────────
export const FLASH_BONUS_PCT = 50;
export const FLASH_CRYSTALS = 10;
export const FLASH_HOURS = 4;

/** XP extra da missão relâmpago concluída no prazo (arredonda para cima, como o banco). */
export function flashBonusXp(missionXp: number, pct = FLASH_BONUS_PCT): number {
  return Math.ceil((missionXp * pct) / 100);
}

/** Tempo restante até o prazo, em milissegundos (0 quando venceu). */
export function flashRemainingMs(deadline: Date, now: Date): number {
  return Math.max(0, deadline.getTime() - now.getTime());
}

/** "3h 12min", "45min", "menos de 1min". */
export function formatRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return 'menos de 1min';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
}
