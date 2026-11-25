/**
 * Títulos: os de nível (automáticos) e os especiais, concedidos pelo banco
 * (`title_catalog` / `user_titles`). O usuário escolhe qual exibir entre os que tem.
 */
import type { ObjectiveCategory } from './habits';
import type { HeroForm } from './hero';
import { RARITY_EN, TITLE_EN } from './contentEn';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export type TitleRarity = 'comum' | 'raro' | 'epico' | 'lendario';
export type TitleKind = 'level' | 'achievement' | 'secret' | 'objective';

export const RARITY_LABEL: Record<TitleRarity, string> = {
  comum: 'Comum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

export const RARITY_COLOR: Record<TitleRarity, string> = {
  comum: '#A1A1AA',
  raro: '#3D7BFF',
  epico: '#A855F7',
  lendario: '#F5B942',
};

export interface TitleInfo {
  kind: TitleKind;
  rarity: TitleRarity;
  name: Record<HeroForm, string>;
  /** Como se conquista (mostrado depois de conquistado, e antes para os não secretos). */
  description: string;
  /** Só nos secretos: a pista mostrada enquanto ainda não foi conquistado. */
  hint?: string;
  minLevel?: number;
  category?: ObjectiveCategory;
}

const same = (n: string) => ({ masculino: n, feminino: n });

export const TITLE_CATALOG = {
  'nivel-1': { kind: 'level', rarity: 'comum', name: same('Aprendiz'), description: 'Nível 1.', minLevel: 1 },
  'nivel-5': { kind: 'level', rarity: 'comum', name: { masculino: 'Aventureiro', feminino: 'Aventureira' }, description: 'Chegou ao nível 5.', minLevel: 5 },
  'nivel-10': { kind: 'level', rarity: 'raro', name: { masculino: 'Desbravador', feminino: 'Desbravadora' }, description: 'Chegou ao nível 10.', minLevel: 10 },
  'nivel-15': { kind: 'level', rarity: 'raro', name: { masculino: 'Veterano', feminino: 'Veterana' }, description: 'Chegou ao nível 15.', minLevel: 15 },
  'nivel-20': { kind: 'level', rarity: 'epico', name: { masculino: 'Campeão', feminino: 'Campeã' }, description: 'Chegou ao nível 20.', minLevel: 20 },
  'nivel-30': { kind: 'level', rarity: 'lendario', name: same('Lenda'), description: 'Chegou ao nível 30.', minLevel: 30 },

  'primeiro-passo': { kind: 'achievement', rarity: 'comum', name: same('Primeiro Passo'), description: 'Concluiu a primeira missão.' },
  centuriao: { kind: 'achievement', rarity: 'raro', name: { masculino: 'Centurião', feminino: 'Centuriã' }, description: 'Concluiu 100 missões.' },
  'mestre-das-manhas': {
    kind: 'achievement',
    rarity: 'raro',
    name: { masculino: 'Mestre das Manhãs', feminino: 'Mestra das Manhãs' },
    description: 'Concluiu 10 missões antes das 8h.',
  },
  'lorde-dos-cristais': {
    kind: 'achievement',
    rarity: 'raro',
    name: { masculino: 'Lorde dos Cristais', feminino: 'Lady dos Cristais' },
    description: 'Ganhou 1.000 Cristais no total.',
  },
  inabalavel: { kind: 'achievement', rarity: 'epico', name: same('Inabalável'), description: 'Completou 30 dias perfeitos.' },

  fenix: {
    kind: 'secret',
    rarity: 'epico',
    name: same('Fênix'),
    description: 'Voltou com um dia perfeito depois de 7 dias parado.',
    hint: 'Às vezes, recomeçar é a maior vitória.',
  },
  'equilibrio-perfeito': {
    kind: 'secret',
    rarity: 'lendario',
    name: same('Equilíbrio Perfeito'),
    description: 'Teve um dia perfeito com missões de 4 áreas diferentes.',
    hint: 'Um dia em que nenhuma parte da vida foi esquecida.',
  },

  'conquista-health': { kind: 'objective', rarity: 'epico', name: same('Corpo Forjado'), description: 'Conquistou um objetivo de Saúde.', category: 'health' },
  'conquista-knowledge': { kind: 'objective', rarity: 'epico', name: same('Mente Desperta'), description: 'Conquistou um objetivo de Conhecimento.', category: 'knowledge' },
  'conquista-career': {
    kind: 'objective',
    rarity: 'epico',
    name: { masculino: 'Artesão do Ofício', feminino: 'Artesã do Ofício' },
    description: 'Conquistou um objetivo de Carreira.',
    category: 'career',
  },
  'conquista-finance': {
    kind: 'objective',
    rarity: 'epico',
    name: { masculino: 'Guardião do Tesouro', feminino: 'Guardiã do Tesouro' },
    description: 'Conquistou um objetivo de Finanças.',
    category: 'finance',
  },
  'conquista-productivity': { kind: 'objective', rarity: 'epico', name: same('Lâmina do Foco'), description: 'Conquistou um objetivo de Produtividade.', category: 'productivity' },
  'conquista-relationships': {
    kind: 'objective',
    rarity: 'epico',
    name: same('Elo Inquebrável'),
    description: 'Conquistou um objetivo de Relacionamentos.',
    category: 'relationships',
  },
  'conquista-wellbeing': { kind: 'objective', rarity: 'epico', name: same('Alma Serena'), description: 'Conquistou um objetivo de Bem-estar.', category: 'wellbeing' },
  'conquista-personal_growth': {
    kind: 'objective',
    rarity: 'epico',
    name: { masculino: 'Renascido', feminino: 'Renascida' },
    description: 'Conquistou um objetivo de Crescimento pessoal.',
    category: 'personal_growth',
  },
} as const satisfies Record<string, TitleInfo>;

export type TitleId = keyof typeof TITLE_CATALOG;
export const TITLE_IDS = Object.keys(TITLE_CATALOG) as TitleId[];

export function isTitleId(id: unknown): id is TitleId {
  return typeof id === 'string' && id in TITLE_CATALOG;
}

export function titleInfo(id: TitleId): TitleInfo {
  return TITLE_CATALOG[id];
}

export function titleName(id: TitleId, form: HeroForm = 'masculino', locale: Locale = DEFAULT_LOCALE): string {
  const en = locale === 'en' ? TITLE_EN[id] : undefined;
  return en ? en.name[form === 'feminino' ? 1 : 0] : TITLE_CATALOG[id].name[form];
}

/** Como se conquista o título, no idioma. */
export function titleDescription(id: TitleId, locale: Locale = DEFAULT_LOCALE): string {
  return (locale === 'en' ? TITLE_EN[id]?.description : undefined) ?? TITLE_CATALOG[id].description;
}

/** Pista dos títulos secretos, no idioma. */
export function titleHint(id: TitleId, locale: Locale = DEFAULT_LOCALE): string | undefined {
  const info: TitleInfo = TITLE_CATALOG[id];
  return (locale === 'en' ? TITLE_EN[id]?.hint : undefined) ?? info.hint;
}

export function rarityLabel(rarity: TitleRarity, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? RARITY_EN[rarity]! : RARITY_LABEL[rarity];
}

/** Título de nível correspondente ao nível atual (o automático). */
export function levelTitleId(level: number): TitleId {
  let id: TitleId = 'nivel-1';
  for (const t of TITLE_IDS) {
    const info: TitleInfo = TITLE_CATALOG[t];
    if (info.kind === 'level' && info.minLevel !== undefined && level >= info.minLevel) id = t;
  }
  return id;
}

/** O usuário tem o título: de nível já alcançado, ou especial já concedido. */
export function hasTitle(id: TitleId, level: number, earned: ReadonlySet<string>): boolean {
  const info: TitleInfo = TITLE_CATALOG[id];
  if (info.kind === 'level') return level >= (info.minLevel ?? 1);
  return earned.has(id);
}

/** Título exibido: o escolhido, se ainda for válido; senão, o de nível atual. */
export function displayedTitle(equipped: string | null | undefined, level: number, earned: ReadonlySet<string>): TitleId {
  if (isTitleId(equipped) && hasTitle(equipped, level, earned)) return equipped;
  return levelTitleId(level);
}

export const RARITY_ORDER: Record<TitleRarity, number> = { comum: 0, raro: 1, epico: 2, lendario: 3 };
