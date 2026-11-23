import { findItem, type HeroLook } from '@per/domain';

/**
 * Paleta dos sprites pixel art do herói. Os PNGs guardam o ÍNDICE da cor
 * (canal R = índice * indexStep); o shader do PixelHero troca o índice pela cor daqui.
 * A ordem espelha tools/sprites/gen_hero.py — mude os dois juntos.
 */
export const SPRITE_PALETTE_SIZE = 28;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const shade = (hex: string, f: number): Rgb =>
  rgb(hex).map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as Rgb;

const tint = (hex: string, a: number): Rgb =>
  rgb(hex).map((v) => Math.round(v + (255 - v) * a)) as Rgb;

/** Cor RGBA normalizada (0..1), no formato do uniform float4 do shader. */
type Vec4 = [number, number, number, number];
const c = ([r, g, b]: Rgb, a = 1): Vec4 => [r / 255, g / 255, b / 255, a];

/** Detalhe de cada classe (bainha do manto, chama, gola). */
const CLASS_TRIM: Partial<Record<HeroLook['heroClass'], string>> = {
  druida: '#7BC47F',
  necromante: '#5CF2A0',
};

const DEFAULT_MAGIC = '#8B5CF6';
/** Aura dourada do estágio lendário (5), quando o herói não escolheu outra. */
const LEGENDARY_AURA = '#FFD36B';

/**
 * Material do equipamento (ombreiras, peitoral, lâminas, escudo) por estágio do caminho:
 * couro → ferro → aço → prata → ouro. [sombra, base, brilho]
 */
const METAL_BY_TIER: readonly [string, string, string][] = [
  ['#6E4A2C', '#93663E', '#B98A5C'], // 0 couro
  ['#6E4A2C', '#93663E', '#B98A5C'], // 1 couro
  ['#5E6672', '#87909C', '#B3BBC6'], // 2 ferro
  ['#7D8696', '#B8C0CC', '#E6EBF2'], // 3 aço
  ['#9AA4B4', '#D6DEE8', '#FFFFFF'], // 4 prata
  ['#A8782A', '#E8BE58', '#FFE9A8'], // 5 ouro
];

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Sombra, base e luz da roupa. Roupas muito escuras (obsidiana) clareiam um pouco,
 *  senão somem no fundo escuro do app e se confundem com o contorno. */
function clothTones(outfit: string): [Rgb, Rgb, Rgb] {
  if (luminance(outfit) < 0.2) return [tint(outfit, 0.1), tint(outfit, 0.22), tint(outfit, 0.4)];
  return [shade(outfit, 0.62), rgb(outfit), tint(outfit, 0.25)];
}

export function spritePalette(hero: HeroLook): Vec4[] {
  const skin = findItem('skin', hero.skin)?.color ?? '#E8B896';
  const hair = findItem('hairColor', hero.hairColor)?.color ?? '#5A3A22';
  const eyes = findItem('eyes', hero.eyes)?.color ?? '#7A4A2A';
  const outfit = findItem('outfit', hero.outfit)?.color ?? '#B7343F';
  const tier = Math.max(0, Math.min(5, hero.tier ?? 3));
  const aura = findItem('aura', hero.aura)?.color ?? (tier === 5 ? LEGENDARY_AURA : DEFAULT_MAGIC);
  const [metalD, metal, metalL] = METAL_BY_TIER[tier]!;
  const trim = CLASS_TRIM[hero.heroClass] ?? '#E8BE58';
  const [clothD, cloth, clothL] = clothTones(outfit);
  return [
    [0, 0, 0, 0], //          0 transparente
    c(rgb('#191626')), //     1 contorno
    c(shade(skin, 0.82)), //  2 pele sombra
    c(rgb(skin)), //          3 pele
    c(shade(hair, 0.7)), //   4 cabelo sombra
    c(rgb(hair)), //          5 cabelo
    c(tint(hair, 0.3)), //    6 cabelo brilho
    c(rgb(eyes)), //          7 íris
    c(rgb('#FFFFFF')), //     8 branco
    c(clothD), //             9 roupa sombra
    c(cloth), //              10 roupa
    c(clothL), //             11 roupa luz
    c(rgb(metalD)), //        12 metal sombra (material do estágio)
    c(rgb(metal)), //         13 metal
    c(rgb(metalL)), //        14 metal brilho
    c(rgb('#5B3B24')), //     15 couro e madeira
    c(rgb('#E8BE58')), //     16 ouro
    c(rgb('#FFE58A')), //     17 brilho
    [0, 0, 0, 0.31], //       18 sombra no chão
    c(rgb(aura)), //          19 aura
    c(tint(aura, 0.5)), //    20 aura clara
    c(rgb(aura)), //          21 gema mágica
    c(rgb(trim)), //          22 detalhe da classe
    c(rgb('#2A2733')), //     23 capuz escuro
    c(rgb('#C8303C')), //     24 vermelho (pluma, faixa, pena)
    c(rgb('#66BB6A')), //     25 folhas
    c(rgb('#4FA3E0')), //     26 pássaro do druida
    c(rgb('#F28CA0')), //     27 bochecha e lábios (forma feminina)
  ];
}
