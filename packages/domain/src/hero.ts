/**
 * Herói do usuário: classe, aparência montável, desbloqueios por nível,
 * títulos e atributos. O nível vem do XP total (level.ts); nada aqui gasta XP.
 */
import type { ObjectiveCategory } from './habits';
import type { Race, VisualKit } from './paths';
import { ATTRIBUTE_EN, FORM_EN, ITEM_EN, SLOT_EN, TITLE_EN } from './contentEn';
import { DEFAULT_LOCALE, type Locale } from './i18n';

// ─────────────────────────────────────────────────────────────
// Classes
// ─────────────────────────────────────────────────────────────
export const HERO_CLASSES = ['guerreiro', 'mago', 'arqueiro', 'monge', 'paladino', 'ladino', 'bardo', 'druida', 'necromante'] as const;
export type HeroClass = (typeof HERO_CLASSES)[number];

/** Forma do personagem: muda o desenho e a concordância dos textos (Guerreiro/Guerreira). */
export const HERO_FORMS = ['masculino', 'feminino'] as const;
export type HeroForm = (typeof HERO_FORMS)[number];
export const HERO_FORM_LABEL: Record<HeroForm, string> = { masculino: 'Masculino', feminino: 'Feminino' };

export function formLabel(form: HeroForm, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? FORM_EN[form]! : HERO_FORM_LABEL[form];
}

export const HERO_CLASS_INFO: Record<HeroClass, { label: Record<HeroForm, string>; motto: string }> = {
  guerreiro: { label: { masculino: 'Guerreiro', feminino: 'Guerreira' }, motto: 'Disciplina forjada todo dia.' },
  mago: { label: { masculino: 'Mago', feminino: 'Maga' }, motto: 'Conhecimento é o maior poder.' },
  arqueiro: { label: { masculino: 'Arqueiro', feminino: 'Arqueira' }, motto: 'Foco no alvo, um passo por vez.' },
  monge: { label: { masculino: 'Monge', feminino: 'Monja' }, motto: 'Equilíbrio entre corpo e mente.' },
  paladino: { label: { masculino: 'Paladino', feminino: 'Paladina' }, motto: 'Escudo erguido pelos outros.' },
  ladino: { label: { masculino: 'Ladino', feminino: 'Ladina' }, motto: 'Silêncio, foco e precisão.' },
  bardo: { label: { masculino: 'Bardo', feminino: 'Barda' }, motto: 'Cada laço vira uma canção.' },
  druida: { label: { masculino: 'Druida', feminino: 'Druida' }, motto: 'Cresce quem cuida das raízes.' },
  necromante: { label: { masculino: 'Necromante', feminino: 'Necromante' }, motto: 'Até a noite guarda conhecimento.' },
};

/**
 * Catálogo das classes (espelha `class_catalog` do banco, que é a fonte de verdade para compra e Cristais).
 * Preço 0 = classe inicial. A vantagem própria é só o texto mostrado; quem calcula é o banco.
 */
export const CLASS_CATALOG: Record<
  HeroClass,
  {
    tier: number;
    minLevel: number;
    price: number;
    area: ObjectiveCategory;
    areaPct: number;
    perk: string | null;
    /** Cristais extras por missão fácil (espelha `easy_extra`). */
    easyExtra?: number;
  }
> = {
  guerreiro: { tier: 1, minLevel: 1, price: 0, area: 'health', areaPct: 10, perk: null },
  mago: { tier: 1, minLevel: 1, price: 0, area: 'knowledge', areaPct: 10, perk: null },
  arqueiro: { tier: 1, minLevel: 1, price: 0, area: 'productivity', areaPct: 10, perk: null },
  monge: { tier: 1, minLevel: 1, price: 0, area: 'wellbeing', areaPct: 10, perk: null },
  paladino: { tier: 2, minLevel: 5, price: 300, area: 'personal_growth', areaPct: 15, perk: null },
  ladino: { tier: 2, minLevel: 5, price: 300, area: 'productivity', areaPct: 15, perk: 'Missão registrada em "Ontem" rende Cristais cheios' },
  bardo: { tier: 2, minLevel: 5, price: 300, area: 'relationships', areaPct: 15, perk: '+5 Cristais no dia perfeito' },
  druida: { tier: 2, minLevel: 5, price: 300, area: 'wellbeing', areaPct: 15, perk: '+2 Cristais por missão fácil', easyExtra: 2 },
  necromante: { tier: 3, minLevel: 10, price: 800, area: 'knowledge', areaPct: 20, perk: '+3 Cristais por missão concluída depois das 20h' },
};

export const CLASS_TIER_LABEL: Record<number, string> = {
  1: 'Inicial',
  2: 'Especialista',
  3: 'Avançada',
  4: 'Rara',
  5: 'Lendária',
};

/** A classe é usável: grátis ou já comprada. */
export function ownsClass(heroClass: HeroClass, owned: ReadonlySet<string>): boolean {
  return CLASS_CATALOG[heroClass].price === 0 || owned.has(heroClass);
}

export type PurchaseStatus = 'free' | 'owned' | 'buyable' | 'needs_level' | 'needs_crystals';

/** Situação da classe na loja para quem tem esse nível, saldo e posses. */
export function purchaseStatus(
  heroClass: HeroClass,
  level: number,
  crystals: number,
  owned: ReadonlySet<string>,
): PurchaseStatus {
  const c = CLASS_CATALOG[heroClass];
  if (c.price === 0) return 'free';
  if (owned.has(heroClass)) return 'owned';
  if (level < c.minLevel) return 'needs_level';
  if (crystals < c.price) return 'needs_crystals';
  return 'buyable';
}

export function heroClassLabel(heroClass: HeroClass, form: HeroForm = 'masculino'): string {
  return HERO_CLASS_INFO[heroClass].label[form];
}

// ─────────────────────────────────────────────────────────────
// Peças da aparência e quando cada uma é desbloqueada
// ─────────────────────────────────────────────────────────────
export interface HeroItem {
  id: string;
  label: string;
  /** Nível em que fica disponível. */
  level: number;
  /** Cor principal da peça (quando é uma cor). */
  color?: string;
  /** Item exclusivo da Loja: comprado com Cristais (em vez de liberado por nível). */
  price?: number;
}

export const SKIN_TONES: readonly HeroItem[] = [
  { id: 'pele1', label: 'Tom 1', level: 1, color: '#F6D7C3' },
  { id: 'pele2', label: 'Tom 2', level: 1, color: '#E8B896' },
  { id: 'pele3', label: 'Tom 3', level: 1, color: '#C98E66' },
  { id: 'pele4', label: 'Tom 4', level: 1, color: '#A26B47' },
  { id: 'pele5', label: 'Tom 5', level: 1, color: '#7A4B2F' },
  { id: 'pele6', label: 'Tom 6', level: 1, color: '#4E2F1E' },
  // Tons de orc e de escamas de draconato (livres para qualquer raça)
  { id: 'verde-claro', label: 'Verde claro', level: 1, color: '#8DBF6A' },
  { id: 'verde', label: 'Verde', level: 1, color: '#5E8C3A' },
  { id: 'cinza', label: 'Cinza', level: 1, color: '#8A8F98' },
  { id: 'escama-vermelha', label: 'Escama vermelha', level: 1, color: '#C2453A' },
  { id: 'escama-azul', label: 'Escama azul', level: 1, color: '#3E6FC4' },
  { id: 'escama-dourada', label: 'Escama dourada', level: 1, color: '#D9A63C' },
];

export const HAIR_STYLES: readonly HeroItem[] = [
  { id: 'curto', label: 'Curto', level: 1 },
  { id: 'longo', label: 'Longo', level: 1 },
  { id: 'raspado', label: 'Raspado', level: 1 },
  { id: 'moicano', label: 'Moicano', level: 3 },
  { id: 'coque', label: 'Coque', level: 4 },
  { id: 'espetado', label: 'Espetado', level: 6 },
  { id: 'tranca', label: 'Trança', level: 8 },
];

export const HAIR_COLORS: readonly HeroItem[] = [
  { id: 'preto', label: 'Preto', level: 1, color: '#1F1A17' },
  { id: 'castanho', label: 'Castanho', level: 1, color: '#5A3A22' },
  { id: 'loiro', label: 'Loiro', level: 1, color: '#E2B857' },
  { id: 'ruivo', label: 'Ruivo', level: 2, color: '#B5482A' },
  { id: 'prata', label: 'Prata', level: 5, color: '#D7DCE3' },
  { id: 'azul', label: 'Azul elétrico', level: 9, color: '#3D7BFF' },
  { id: 'violeta', label: 'Violeta', level: 12, color: '#9B5CF6' },
  // Loja
  { id: 'loja-cabelo-rosa', label: 'Rosa chiclete', level: 1, color: '#F472B6', price: 100 },
  { id: 'loja-cabelo-menta', label: 'Menta', level: 1, color: '#34D399', price: 100 },
  { id: 'loja-cabelo-fogo', label: 'Fogo', level: 1, color: '#F97316', price: 100 },
  { id: 'loja-cabelo-neve', label: 'Neve', level: 1, color: '#F5F5F5', price: 150 },
];

export const EYE_COLORS: readonly HeroItem[] = [
  { id: 'castanho', label: 'Castanho', level: 1, color: '#7A4A2A' },
  { id: 'azul', label: 'Azul', level: 1, color: '#2F7BE0' },
  { id: 'verde', label: 'Verde', level: 1, color: '#2E9A5C' },
  { id: 'ambar', label: 'Âmbar', level: 3, color: '#E0951F' },
  { id: 'violeta', label: 'Violeta', level: 7, color: '#8E4FE8' },
  { id: 'carmesim', label: 'Carmesim', level: 12, color: '#D8283F' },
  { id: 'dourado', label: 'Dourado', level: 16, color: '#F2C230' },
];

export const OUTFIT_COLORS: readonly HeroItem[] = [
  { id: 'carmesim', label: 'Carmesim', level: 1, color: '#B7343F' },
  { id: 'anil', label: 'Anil', level: 1, color: '#3550A8' },
  { id: 'floresta', label: 'Floresta', level: 1, color: '#2F7A4F' },
  { id: 'ametista', label: 'Ametista', level: 3, color: '#6E3FB8' },
  { id: 'obsidiana', label: 'Obsidiana', level: 6, color: '#23232B' },
  { id: 'aurora', label: 'Aurora', level: 11, color: '#16A99A' },
  { id: 'ouro', label: 'Ouro real', level: 14, color: '#C9962B' },
  // Loja
  { id: 'loja-roupa-marfim', label: 'Marfim', level: 1, color: '#E8DCC2', price: 120 },
  { id: 'loja-roupa-vinho', label: 'Vinho', level: 1, color: '#7A2236', price: 120 },
  { id: 'loja-roupa-celeste', label: 'Celeste', level: 1, color: '#5DADE2', price: 120 },
  { id: 'loja-roupa-grafite', label: 'Grafite', level: 1, color: '#52606D', price: 120 },
];

export const AURAS: readonly HeroItem[] = [
  { id: 'nenhuma', label: 'Nenhuma', level: 1 },
  { id: 'brasa', label: 'Brasa', level: 5, color: '#FF8A3D' },
  { id: 'mare', label: 'Maré', level: 7, color: '#3DC8FF' },
  { id: 'relampago', label: 'Relâmpago', level: 10, color: '#F5E642' },
  { id: 'eclipse', label: 'Eclipse', level: 15, color: '#A855F7' },
  { id: 'solar', label: 'Solar', level: 20, color: '#FFD36B' },
  // Loja
  { id: 'loja-aura-gelo', label: 'Gelo eterno', level: 1, color: '#9EE7FF', price: 200 },
  { id: 'loja-aura-rubi', label: 'Rubi', level: 1, color: '#E0245E', price: 200 },
  { id: 'loja-aura-esmeralda', label: 'Esmeralda', level: 1, color: '#2EE59D', price: 200 },
  { id: 'loja-aura-sakura', label: 'Sakura', level: 1, color: '#FF8FC7', price: 250 },
  { id: 'loja-aura-sombra', label: 'Sombra', level: 1, color: '#6B4FBB', price: 300 },
];

export const ACCESSORIES: readonly HeroItem[] = [
  { id: 'nenhum', label: 'Nenhum', level: 1 },
  { id: 'faixa', label: 'Faixa', level: 2 },
  { id: 'capa', label: 'Capa', level: 4 },
  { id: 'elmo', label: 'Elmo', level: 9 },
  { id: 'coroa', label: 'Coroa', level: 18 },
];

export type HeroSlot = 'skin' | 'eyes' | 'hair' | 'hairColor' | 'outfit' | 'aura' | 'accessory';

export const HERO_SLOTS: Record<HeroSlot, { label: string; items: readonly HeroItem[] }> = {
  skin: { label: 'Tom de pele', items: SKIN_TONES },
  eyes: { label: 'Cor dos olhos', items: EYE_COLORS },
  hair: { label: 'Cabelo', items: HAIR_STYLES },
  hairColor: { label: 'Cor do cabelo', items: HAIR_COLORS },
  outfit: { label: 'Cor da roupa', items: OUTFIT_COLORS },
  aura: { label: 'Aura', items: AURAS },
  accessory: { label: 'Acessório', items: ACCESSORIES },
};

export interface HeroLook {
  /** Corpo desenhado (uma das 9 classes de base). */
  heroClass: HeroClass;
  /** Visual do estágio (arma, cabeça, costas). Ausente = o da própria classe. */
  kit?: VisualKit;
  /** Estágio do caminho (0–5): muda o material do equipamento. */
  tier?: number;
  /** Raça (só visual). */
  race?: Race;
  form: HeroForm;
  skin: string;
  eyes: string;
  hair: string;
  hairColor: string;
  outfit: string;
  aura: string;
  accessory: string;
}

export const DEFAULT_HERO: HeroLook = {
  heroClass: 'guerreiro',
  form: 'masculino',
  skin: 'pele2',
  eyes: 'castanho',
  hair: 'curto',
  hairColor: 'castanho',
  outfit: 'carmesim',
  aura: 'nenhuma',
  accessory: 'nenhum',
};

export function slotLabel(slot: HeroSlot, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? SLOT_EN[slot]! : HERO_SLOTS[slot].label;
}

/** Nome da peça no idioma (o português fica em `item.label`). */
export function itemLabel(slot: HeroSlot, item: HeroItem, locale: Locale = DEFAULT_LOCALE): string {
  return (locale === 'en' ? ITEM_EN[slot]?.[item.id] : undefined) ?? item.label;
}

export function findItem(slot: HeroSlot, id: string): HeroItem | undefined {
  return HERO_SLOTS[slot].items.find((i) => i.id === id);
}

/** Liberado: itens comuns pelo nível; itens da Loja, só se comprados (`owned`). */
export function isUnlocked(item: HeroItem, level: number, owned: ReadonlySet<string> = new Set()): boolean {
  return item.price !== undefined ? owned.has(item.id) : level >= item.level;
}

/** Cosméticos vendidos na Loja (espelha `cosmetic_catalog` do banco). */
export const SHOP_COSMETICS: readonly { slot: HeroSlot; item: HeroItem }[] = (
  ['aura', 'outfit', 'hairColor'] as HeroSlot[]
).flatMap((slot) => HERO_SLOTS[slot].items.filter((i) => i.price !== undefined).map((item) => ({ slot, item })));

/**
 * Lê a aparência salva (jsonb livre) e garante que só há peças existentes e
 * já desbloqueadas no nível atual; o resto volta ao padrão.
 */
/** `owned`: ids comprados (cosméticos da Loja e, no legado, classes pagas). */
export function sanitizeHero(raw: unknown, level: number, owned: ReadonlySet<string> = new Set()): HeroLook {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const known = HERO_CLASSES.includes(obj.heroClass as HeroClass) ? (obj.heroClass as HeroClass) : null;
  // Classe paga sem compra (ou desconhecida) volta à inicial padrão.
  const heroClass = known && ownsClass(known, owned) ? known : DEFAULT_HERO.heroClass;
  const form = HERO_FORMS.includes(obj.form as HeroForm) ? (obj.form as HeroForm) : DEFAULT_HERO.form;
  const pick = (slot: HeroSlot, key: keyof Omit<HeroLook, 'heroClass' | 'form' | 'kit' | 'tier' | 'race'>) => {
    const item = typeof obj[key] === 'string' ? findItem(slot, obj[key] as string) : undefined;
    return item && isUnlocked(item, level, owned) ? item.id : DEFAULT_HERO[key];
  };
  return {
    heroClass,
    form,
    skin: pick('skin', 'skin'),
    eyes: pick('eyes', 'eyes'),
    hair: pick('hair', 'hair'),
    hairColor: pick('hairColor', 'hairColor'),
    outfit: pick('outfit', 'outfit'),
    aura: pick('aura', 'aura'),
    accessory: pick('accessory', 'accessory'),
  };
}

/** `true` se o usuário ainda não personalizou o herói (o perfil guarda `{}`). */
export function isHeroUnset(raw: unknown): boolean {
  return !raw || typeof raw !== 'object' || !('heroClass' in raw);
}

// ─────────────────────────────────────────────────────────────
// Títulos e desbloqueios por nível
// ─────────────────────────────────────────────────────────────
export const HERO_TITLES: readonly { level: number; title: Record<HeroForm, string> }[] = [
  { level: 1, title: { masculino: 'Aprendiz', feminino: 'Aprendiz' } },
  { level: 5, title: { masculino: 'Aventureiro', feminino: 'Aventureira' } },
  { level: 10, title: { masculino: 'Desbravador', feminino: 'Desbravadora' } },
  { level: 15, title: { masculino: 'Veterano', feminino: 'Veterana' } },
  { level: 20, title: { masculino: 'Campeão', feminino: 'Campeã' } },
  { level: 30, title: { masculino: 'Lenda', feminino: 'Lenda' } },
];

function levelTitle(t: (typeof HERO_TITLES)[number], form: HeroForm, locale: Locale): string {
  const en = locale === 'en' ? TITLE_EN[`nivel-${t.level}`] : undefined;
  return en ? en.name[form === 'feminino' ? 1 : 0] : t.title[form];
}

export function heroTitle(level: number, form: HeroForm = 'masculino', locale: Locale = DEFAULT_LOCALE): string {
  let title = levelTitle(HERO_TITLES[0]!, form, locale);
  for (const t of HERO_TITLES) if (level >= t.level) title = levelTitle(t, form, locale);
  return title;
}

/** Faixa visual do herói (0, 1, 2…): muda a moldura e o brilho a cada título. */
export function heroTier(level: number): number {
  let tier = 0;
  HERO_TITLES.forEach((t, i) => {
    if (level >= t.level) tier = i;
  });
  return tier;
}

export interface Unlock {
  level: number;
  kind: 'title' | HeroSlot;
  label: string;
}

/** Tudo o que é liberado ao passar de `fromLevel` para `toLevel` (exclusivo → inclusivo). */
export function unlocksBetween(
  fromLevel: number,
  toLevel: number,
  form: HeroForm = 'masculino',
  locale: Locale = DEFAULT_LOCALE,
): Unlock[] {
  const out: Unlock[] = [];
  const titleWord = locale === 'en' ? 'Title' : 'Título';
  for (const t of HERO_TITLES) {
    if (t.level > fromLevel && t.level <= toLevel)
      out.push({ level: t.level, kind: 'title', label: `${titleWord}: ${levelTitle(t, form, locale)}` });
  }
  for (const slot of Object.keys(HERO_SLOTS) as HeroSlot[]) {
    for (const item of HERO_SLOTS[slot].items) {
      if (item.level > fromLevel && item.level <= toLevel) {
        out.push({ level: item.level, kind: slot, label: `${slotLabel(slot, locale)}: ${itemLabel(slot, item, locale)}` });
      }
    }
  }
  return out.sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
}

/** Próximo desbloqueio depois do nível atual, para mostrar "No nível N: …". */
export function nextUnlock(level: number, form: HeroForm = 'masculino', locale: Locale = DEFAULT_LOCALE): Unlock | null {
  for (let target = level + 1; target <= level + 50; target++) {
    const found = unlocksBetween(target - 1, target, form, locale);
    if (found.length > 0) return found[0]!;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Atributos: o XP de cada área vira um atributo do herói
// ─────────────────────────────────────────────────────────────
export const HERO_ATTRIBUTES: Record<ObjectiveCategory, { key: string; label: string }> = {
  health: { key: 'vigor', label: 'Vigor' },
  wellbeing: { key: 'espirito', label: 'Espírito' },
  knowledge: { key: 'sabedoria', label: 'Sabedoria' },
  career: { key: 'oficio', label: 'Ofício' },
  productivity: { key: 'foco', label: 'Foco' },
  finance: { key: 'fortuna', label: 'Fortuna' },
  relationships: { key: 'carisma', label: 'Carisma' },
  personal_growth: { key: 'determinacao', label: 'Determinação' },
};

export function attributeLabel(category: ObjectiveCategory, locale: Locale = DEFAULT_LOCALE): string {
  return locale === 'en' ? ATTRIBUTE_EN[category] : HERO_ATTRIBUTES[category].label;
}

export interface AttributeProgress {
  category: ObjectiveCategory;
  label: string;
  xp: number;
  /** Nível do atributo: 1 + ⌊√(xp / 20)⌋ (20 XP → 2, 80 → 3, 180 → 4…). */
  level: number;
  /** Fração de 0 a 1 até o próximo nível do atributo. */
  progress: number;
}

export function attributeLevel(xp: number): { level: number; progress: number } {
  const x = Math.max(0, xp);
  const level = 1 + Math.floor(Math.sqrt(x / 20));
  const start = 20 * (level - 1) ** 2;
  const next = 20 * level ** 2;
  return { level, progress: (x - start) / (next - start) };
}

/** Ficha de atributos, em ordem fixa (mesma das categorias), com zero onde não há XP. */
export function heroAttributes(
  xpByCategory: readonly { category: string; xp: number }[],
  categories: readonly ObjectiveCategory[],
  locale: Locale = DEFAULT_LOCALE,
): AttributeProgress[] {
  const sums = new Map<string, number>();
  for (const r of xpByCategory) sums.set(r.category, (sums.get(r.category) ?? 0) + r.xp);
  return categories.map((category) => {
    const xp = sums.get(category) ?? 0;
    return { category, label: attributeLabel(category, locale), xp, ...attributeLevel(xp) };
  });
}

/** Cristais base por dificuldade (espelha `coin_rules`; o banco é quem concede). */
export const DEFAULT_CRYSTALS: Record<'easy' | 'medium' | 'hard', number> = { easy: 5, medium: 10, hard: 15 };

/**
 * Cristais que uma missão concluída hoje rende com a classe equipada (mesma conta de `log_habit`:
 * base + bônus da área arredondado para cima + extra da classe). Hábito sem área conta como Crescimento pessoal.
 * Não inclui a vantagem noturna do Necromante, que depende do horário.
 */
export function estimateMissionCrystals(
  difficulty: 'easy' | 'medium' | 'hard',
  category: ObjectiveCategory | null,
  heroClass: HeroClass,
): number {
  const c = CLASS_CATALOG[heroClass];
  let coins = DEFAULT_CRYSTALS[difficulty];
  if ((category ?? 'personal_growth') === c.area) coins += Math.ceil((coins * c.areaPct) / 100);
  if (difficulty === 'easy') coins += c.easyExtra ?? 0;
  return coins;
}
