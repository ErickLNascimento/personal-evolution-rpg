import { findItem, type HeroLook } from '@per/domain';
import { useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** Escurece (factor < 1) ou clareia (factor > 1) uma cor #RRGGBB. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Clareia em direção ao branco (bom para brilho em cores escuras). */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `#${((1 << 24) | (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255)).toString(16).slice(1)}`;
}

const INK = '#191626';
const LINE = 2.4;
const LEATHER = '#5B3B24';
const METAL = '#B8C0CC';
const GOLD = '#E8BE58';
const HOOD = '#211C30';

// Aura em chamas pontiagudas ao redor do corpo (estilo "power-up").
const AURA_FLAME =
  'M100 4 L113 38 L132 14 L131 52 L160 38 L148 76 L182 78 L156 106 L186 126 L154 140 L178 172 L144 172 L160 210 L126 198 L128 236 L100 214 L72 236 L74 198 L40 210 L56 172 L22 172 L46 140 L14 126 L44 106 L18 78 L52 76 L40 38 L69 52 L68 14 L87 38 Z';

/**
 * Herói em estilo anime, montado em camadas SVG (viewBox 200×240), com contorno e sombra chapada.
 * Ordem: aura → cabelo de trás/capa/arco → corpo da classe → pescoço e rosto → olhos → franja → acessório.
 * `animated` faz a aura pulsar.
 */
export function HeroAvatar({
  hero,
  size = 120,
  animated = false,
}: {
  hero: HeroLook;
  size?: number;
  animated?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const skin = findItem('skin', hero.skin)?.color ?? '#E8B896';
  const hair = findItem('hairColor', hero.hairColor)?.color ?? '#5A3A22';
  const eyes = findItem('eyes', hero.eyes)?.color ?? '#7A4A2A';
  const outfit = findItem('outfit', hero.outfit)?.color ?? '#B7343F';
  const aura = findItem('aura', hero.aura)?.color;
  const dark = shade(outfit, 0.62);
  const skinShadow = shade(skin, 0.82);
  const height = (size * 240) / 200;
  const fem = hero.form === 'feminino';
  const sL = fem ? 74 : 70;
  const sR = fem ? 126 : 130;

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (animated && aura) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }
  }, [animated, aura, pulse]);
  const auraStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pulse.value * 0.4,
    transform: [{ scaleX: 0.96 + pulse.value * 0.06 }, { scaleY: 0.95 + pulse.value * 0.09 }],
  }));

  const longBack = hero.hair === 'longo';
  const cls = hero.heroClass;
  // Classes de manto longo (sem pernas à mostra).
  const robe = cls === 'mago' || cls === 'druida' || cls === 'necromante';
  const trim = cls === 'druida' ? '#7BC47F' : cls === 'necromante' ? '#5CF2A0' : GOLD;

  return (
    <View
      style={{ width: size, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Seu herói"
    >
      {aura && (
        <Animated.View style={[StyleSheet.absoluteFill, auraStyle]}>
          <Svg width={size} height={height} viewBox="0 0 200 240">
            <Defs>
              <RadialGradient id={`aura${uid}`} cx="50%" cy="58%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor={tint(aura, 0.6)} stopOpacity={0.95} />
                <Stop offset="55%" stopColor={aura} stopOpacity={0.6} />
                <Stop offset="100%" stopColor={aura} stopOpacity={0.05} />
              </RadialGradient>
            </Defs>
            <Path
              d={AURA_FLAME}
              fill={`url(#aura${uid})`}
              stroke={tint(aura, 0.4)}
              strokeWidth={1.5}
              strokeOpacity={0.6}
            />
          </Svg>
        </Animated.View>
      )}

      <Svg width={size} height={height} viewBox="0 0 200 240" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`iris${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={shade(eyes, 0.45)} />
            <Stop offset="55%" stopColor={eyes} />
            <Stop offset="100%" stopColor={tint(eyes, 0.55)} />
          </LinearGradient>
        </Defs>

        <Ellipse cx={100} cy={232} rx={50} ry={6} fill="#000" opacity={0.3} />

        {/* ── Atrás do corpo ─────────────────────────── */}
        {longBack && (
          <Path
            d="M56 80 Q44 34 100 20 Q156 34 144 80 L152 156 L139 146 L136 168 L123 150 L77 150 L64 168 L61 146 L48 156 Z"
            fill={shade(hair, 0.78)}
            stroke={INK}
            strokeWidth={LINE}
            strokeLinejoin="round"
          />
        )}
        {hero.accessory === 'capa' && (
          <Path
            d="M68 134 L36 228 Q100 240 164 228 L132 134 Z"
            fill={shade(outfit, 0.45)}
            stroke={INK}
            strokeWidth={LINE}
            strokeLinejoin="round"
          />
        )}
        {cls === 'necromante' && (
          <Path
            d="M48 98 Q46 22 100 20 Q154 22 152 98 L144 128 L56 128 Z"
            fill={HOOD}
            stroke={INK}
            strokeWidth={LINE}
            strokeLinejoin="round"
          />
        )}
        {cls === 'ladino' && (
          <Path
            d="M54 94 Q52 30 100 28 Q148 30 146 94 L138 118 L62 118 Z"
            fill={shade(outfit, 0.45)}
            stroke={INK}
            strokeWidth={LINE}
            strokeLinejoin="round"
          />
        )}
        {cls === 'bardo' && (
          <G>
            <Line
              x1={126}
              y1={142}
              x2={112}
              y2={96}
              stroke={INK}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <Line
              x1={126}
              y1={142}
              x2={112}
              y2={96}
              stroke="#7A4B2F"
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Ellipse
              cx={142}
              cy={164}
              rx={20}
              ry={26}
              fill="#C1803F"
              stroke={INK}
              strokeWidth={LINE}
              transform="rotate(-25 142 164)"
            />
            <Circle cx={140} cy={160} r={6} fill="#4A2C17" />
          </G>
        )}
        {hero.heroClass === 'arqueiro' && (
          <G>
            <Path
              d="M154 104 Q196 168 154 232"
              stroke={INK}
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M154 104 Q196 168 154 232"
              stroke={LEATHER}
              strokeWidth={4.5}
              fill="none"
              strokeLinecap="round"
            />
            <Line x1={154} y1={104} x2={154} y2={232} stroke="#F2F2F2" strokeWidth={1.4} />
            <Rect
              x={36}
              y={120}
              width={15}
              height={48}
              rx={5}
              fill={LEATHER}
              stroke={INK}
              strokeWidth={LINE}
              transform="rotate(-18 43 144)"
            />
            <Path
              d="M40 116 L34 98 L44 108 Z M48 114 L48 94 L54 108 Z"
              fill="#F2F2F2"
              stroke={INK}
              strokeWidth={1.2}
            />
          </G>
        )}

        {/* ── Corpo da classe ────────────────────────── */}
        {robe ? (
          <G>
            <Path
              d={
                fem
                  ? 'M72 134 Q100 128 128 134 L131 162 Q127 170 133 178 L152 228 Q100 238 48 228 L67 178 Q73 170 69 162 Z'
                  : 'M68 134 Q100 128 132 134 L152 228 Q100 238 48 228 Z'
              }
              fill={outfit}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path d="M100 140 L132 134 L152 228 Q126 236 100 236 Z" fill="#000" opacity={0.16} />
            <Path d="M54 218 Q100 230 146 218" stroke={trim} strokeWidth={4} fill="none" />
            <Path d="M100 146 L100 232" stroke={dark} strokeWidth={3} />
            {cls === 'mago' && (
              <Path
                d="M88 160 L92 168 L100 170 L92 172 L88 180 L84 172 L76 170 L84 168 Z"
                fill={GOLD}
                stroke={INK}
                strokeWidth={1}
              />
            )}
            {cls === 'necromante' && (
              <Path d="M84 164 L100 176 L116 164" stroke={trim} strokeWidth={2.5} fill="none" />
            )}
            {cls === 'druida' && (
              <Path
                d="M80 172 Q100 182 120 172"
                stroke={trim}
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
              />
            )}
          </G>
        ) : (
          <G>
            <Rect
              x={78}
              y={194}
              width={18}
              height={30}
              rx={5}
              fill="#2A2733"
              stroke={INK}
              strokeWidth={LINE}
            />
            <Rect
              x={104}
              y={194}
              width={18}
              height={30}
              rx={5}
              fill="#2A2733"
              stroke={INK}
              strokeWidth={LINE}
            />
            <Path
              d="M74 214 L98 214 L98 228 Q86 232 72 228 Z"
              fill={LEATHER}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path
              d="M102 214 L126 214 L128 228 Q114 232 102 228 Z"
              fill={LEATHER}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path
              d={
                fem
                  ? 'M74 134 Q100 128 126 134 L130 162 Q126 170 132 178 L144 202 Q100 212 56 202 L68 178 Q74 170 70 162 Z'
                  : 'M70 134 Q100 128 130 134 L140 200 Q100 208 60 200 Z'
              }
              fill={outfit}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path
              d={
                fem
                  ? 'M100 138 L126 134 L144 202 Q122 210 100 210 Z'
                  : 'M100 138 L130 134 L140 200 Q120 206 100 206 Z'
              }
              fill="#000"
              opacity={0.16}
            />
          </G>
        )}

        {/* Gola alta, comum nos heróis de anime */}
        <Path
          d="M84 130 L100 152 L116 130 L110 128 L100 142 L90 128 Z"
          fill={dark}
          stroke={INK}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />

        {/* Braços com contorno e mãos */}
        <Path
          d={`M${sL} 140 Q52 156 54 182`}
          stroke={INK}
          strokeWidth={fem ? 17 : 19}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={`M${sL} 140 Q52 156 54 182`}
          stroke={outfit}
          strokeWidth={fem ? 12.5 : 14.5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={`M${sR} 140 Q148 156 146 182`}
          stroke={INK}
          strokeWidth={fem ? 17 : 19}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={`M${sR} 140 Q148 156 146 182`}
          stroke={dark}
          strokeWidth={fem ? 12.5 : 14.5}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={54} cy={188} r={7.5} fill={skin} stroke={INK} strokeWidth={LINE} />
        <Circle cx={146} cy={188} r={7.5} fill={skinShadow} stroke={INK} strokeWidth={LINE} />

        {hero.heroClass === 'guerreiro' && (
          <G>
            <Rect
              x={60}
              y={170}
              width={80}
              height={9}
              rx={3}
              fill={LEATHER}
              stroke={INK}
              strokeWidth={1.6}
            />
            <Rect
              x={94}
              y={168}
              width={12}
              height={13}
              rx={2}
              fill={GOLD}
              stroke={INK}
              strokeWidth={1.4}
            />
            <Path
              d={`M${sL - 18} 140 Q${sL - 4} 124 ${sL + 14} 134 Q${sL} 146 ${sL - 18} 140 Z`}
              fill={METAL}
              stroke={INK}
              strokeWidth={LINE}
            />
            <Path
              d={`M${sR + 18} 140 Q${sR + 4} 124 ${sR - 14} 134 Q${sR} 146 ${sR + 18} 140 Z`}
              fill={shade(METAL, 0.85)}
              stroke={INK}
              strokeWidth={LINE}
            />
            {/* Espada com fio brilhando */}
            <Path
              d="M150 190 L180 236 L172 238 L144 194 Z"
              fill="#E6EBF2"
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Line x1={150} y1={195} x2={174} y2={234} stroke="#FFFFFF" strokeWidth={1.4} />
            <Path
              d="M136 192 L162 180 L165 186 L139 198 Z"
              fill={GOLD}
              stroke={INK}
              strokeWidth={1.6}
            />
          </G>
        )}
        {hero.heroClass === 'mago' && (
          <G>
            <Line
              x1={164}
              y1={112}
              x2={164}
              y2={232}
              stroke={INK}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <Line
              x1={164}
              y1={112}
              x2={164}
              y2={232}
              stroke={LEATHER}
              strokeWidth={4.5}
              strokeLinecap="round"
            />
            <Path
              d="M164 80 L176 102 L164 120 L152 102 Z"
              fill={aura ?? '#8B5CF6'}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path d="M164 84 L170 100 L164 106 Z" fill="#FFFFFF" opacity={0.75} />
          </G>
        )}
        {hero.heroClass === 'arqueiro' && (
          <G>
            <Rect
              x={60}
              y={172}
              width={80}
              height={8}
              rx={3}
              fill={LEATHER}
              stroke={INK}
              strokeWidth={1.6}
            />
            <Path d="M72 136 L130 194" stroke={INK} strokeWidth={8} />
            <Path d="M72 136 L130 194" stroke={LEATHER} strokeWidth={5} />
          </G>
        )}
        {hero.heroClass === 'monge' && (
          <G>
            <Rect
              x={60}
              y={168}
              width={80}
              height={10}
              rx={4}
              fill={GOLD}
              stroke={INK}
              strokeWidth={1.6}
            />
            <Path
              d="M126 178 L136 204 L124 204 Z"
              fill={GOLD}
              stroke={INK}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
            {[80, 89, 100, 111, 120].map((x, i) => (
              <Circle
                key={x}
                cx={x}
                cy={140 + (i === 2 ? 7 : i % 2 === 0 ? 0 : 4)}
                r={4}
                fill="#7A4B2F"
                stroke={INK}
                strokeWidth={1}
              />
            ))}
          </G>
        )}

        {cls === 'paladino' && (
          <G>
            <Rect
              x={60}
              y={170}
              width={80}
              height={9}
              rx={3}
              fill={LEATHER}
              stroke={INK}
              strokeWidth={1.6}
            />
            <Path
              d="M80 140 Q100 133 120 140 L118 168 Q100 175 82 168 Z"
              fill={METAL}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Circle cx={100} cy={154} r={6} fill={GOLD} stroke={INK} strokeWidth={1.4} />
            {/* Martelo erguido na mão direita */}
            <Line
              x1={146}
              y1={190}
              x2={158}
              y2={118}
              stroke={INK}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <Line
              x1={146}
              y1={190}
              x2={158}
              y2={118}
              stroke={LEATHER}
              strokeWidth={5}
              strokeLinecap="round"
            />
            <Rect
              x={144}
              y={100}
              width={30}
              height={20}
              rx={3}
              fill={METAL}
              stroke={INK}
              strokeWidth={LINE}
              transform="rotate(10 159 110)"
            />
            {/* Escudo com sol no braço esquerdo */}
            <Circle cx={46} cy={174} r={22} fill="#EDE6D3" stroke={INK} strokeWidth={LINE} />
            <Circle cx={46} cy={174} r={15} fill="none" stroke={GOLD} strokeWidth={3} />
            <Circle cx={46} cy={174} r={6} fill={GOLD} stroke={INK} strokeWidth={1.2} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <Line
                key={a}
                x1={46 + Math.cos((a * Math.PI) / 180) * 8}
                y1={174 + Math.sin((a * Math.PI) / 180) * 8}
                x2={46 + Math.cos((a * Math.PI) / 180) * 12}
                y2={174 + Math.sin((a * Math.PI) / 180) * 12}
                stroke={GOLD}
                strokeWidth={2}
              />
            ))}
          </G>
        )}
        {cls === 'ladino' && (
          <G>
            <Rect
              x={60}
              y={172}
              width={80}
              height={8}
              rx={3}
              fill={LEATHER}
              stroke={INK}
              strokeWidth={1.6}
            />
            <Path
              d="M66 176 L52 206 L56 208 L72 180 Z"
              fill="#DDE2EA"
              stroke={INK}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <Path
              d="M134 176 L148 206 L144 208 L128 180 Z"
              fill="#DDE2EA"
              stroke={INK}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <Rect
              x={62}
              y={170}
              width={14}
              height={6}
              rx={2}
              fill={GOLD}
              stroke={INK}
              strokeWidth={1.2}
            />
            <Rect
              x={124}
              y={170}
              width={14}
              height={6}
              rx={2}
              fill={GOLD}
              stroke={INK}
              strokeWidth={1.2}
            />
          </G>
        )}
        {cls === 'bardo' && (
          <G>
            <Rect
              x={60}
              y={170}
              width={80}
              height={8}
              rx={3}
              fill={LEATHER}
              stroke={INK}
              strokeWidth={1.6}
            />
            <Path
              d="M84 132 Q92 142 100 134 Q108 142 116 132"
              stroke="#F4EBDD"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        )}
        {cls === 'druida' && (
          <G>
            {/* Cajado de galho vivo com folhas */}
            <Path
              d="M164 232 Q158 190 166 150 Q170 128 160 108"
              stroke={INK}
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d="M164 232 Q158 190 166 150 Q170 128 160 108"
              stroke="#6B4423"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
            />
            <Ellipse
              cx={154}
              cy={104}
              rx={9}
              ry={5}
              fill="#4CAF50"
              stroke={INK}
              strokeWidth={1.4}
              transform="rotate(-30 154 104)"
            />
            <Ellipse
              cx={168}
              cy={102}
              rx={9}
              ry={5}
              fill="#66BB6A"
              stroke={INK}
              strokeWidth={1.4}
              transform="rotate(30 168 102)"
            />
            <Ellipse
              cx={161}
              cy={94}
              rx={8}
              ry={5}
              fill="#81C784"
              stroke={INK}
              strokeWidth={1.4}
              transform="rotate(-80 161 94)"
            />
            {/* Pássaro no ombro esquerdo */}
            <Ellipse
              cx={64}
              cy={128}
              rx={10}
              ry={7}
              fill="#4FA3E0"
              stroke={INK}
              strokeWidth={1.6}
            />
            <Circle cx={58} cy={122} r={6} fill="#4FA3E0" stroke={INK} strokeWidth={1.6} />
            <Path d="M52 122 L47 124 L52 125 Z" fill={GOLD} stroke={INK} strokeWidth={1} />
            <Circle cx={57} cy={121} r={1.2} fill={INK} />
            <Path d="M72 128 L80 124 L76 132 Z" fill="#2F7FBF" stroke={INK} strokeWidth={1} />
          </G>
        )}
        {cls === 'necromante' && (
          <G>
            {/* Cajado com crânio e chama verde */}
            <Line
              x1={164}
              y1={108}
              x2={164}
              y2={232}
              stroke={INK}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <Line
              x1={164}
              y1={108}
              x2={164}
              y2={232}
              stroke="#3A2E2A"
              strokeWidth={4.5}
              strokeLinecap="round"
            />
            <Path
              d="M164 58 Q176 74 170 86 Q176 82 174 72 Q182 88 166 96 Q150 90 156 76 Q156 84 160 84 Q154 70 164 58 Z"
              fill="#5CF2A0"
              stroke={INK}
              strokeWidth={1.4}
              opacity={0.95}
            />
            <Circle cx={164} cy={100} r={12} fill="#ECE7DA" stroke={INK} strokeWidth={LINE} />
            <Rect
              x={158}
              y={106}
              width={12}
              height={8}
              rx={2}
              fill="#ECE7DA"
              stroke={INK}
              strokeWidth={1.6}
            />
            <Circle cx={159.5} cy={99} r={3} fill={INK} />
            <Circle cx={168.5} cy={99} r={3} fill={INK} />
            {/* Espíritos flutuando */}
            {(
              [
                [30, 112, 1],
                [178, 160, 0.8],
                [36, 200, 0.7],
              ] as const
            ).map(([x, y, k]) => (
              <Path
                key={`${x}-${y}`}
                d={`M${x} ${y} q${-7 * k} ${-6 * k} 0 ${-18 * k} q${7 * k} ${12 * k} 0 ${18 * k} Z`}
                fill="#5CF2A0"
                opacity={0.7}
                stroke="#2BB673"
                strokeWidth={1}
              />
            ))}
          </G>
        )}

        {/* Cabelo de trás (volume atrás da cabeça) */}
        <BackHair style={hero.hair} color={hair} />

        {/* ── Pescoço e rosto ────────────────────────── */}
        <Path
          d="M91 116 L91 134 Q100 138 109 134 L109 116 Z"
          fill={skinShadow}
          stroke={INK}
          strokeWidth={LINE}
        />
        <Ellipse cx={64} cy={88} rx={5} ry={9} fill={skin} stroke={INK} strokeWidth={LINE} />
        <Ellipse cx={136} cy={88} rx={5} ry={9} fill={skin} stroke={INK} strokeWidth={LINE} />
        <Path
          d="M64 66 Q64 34 100 32 Q136 34 136 66 L135 88 Q133 108 116 120 Q106 128 100 128 Q94 128 84 120 Q67 108 65 88 Z"
          fill={skin}
          stroke={INK}
          strokeWidth={LINE}
          strokeLinejoin="round"
        />
        {/* Sombra da franja e do lado do rosto (cel shading) */}
        {hero.hair !== 'raspado' && hero.hair !== 'moicano' && (
          <Path d="M66 66 Q100 82 134 66 L134 74 Q100 90 66 74 Z" fill={skinShadow} opacity={0.7} />
        )}
        <Path
          d="M134 84 Q132 108 116 120 Q108 125 104 126 Q124 110 126 86 Z"
          fill={skinShadow}
          opacity={0.6}
        />

        {/* Olhos grandes: esclera, íris em degradê, pupila e brilhos */}
        <Eye side="left" fem={fem} iris={`url(#iris${uid})`} brow={shade(hair, 0.7)} />
        <Eye side="right" fem={fem} iris={`url(#iris${uid})`} brow={shade(hair, 0.7)} />

        <Path
          d="M101 100 L99 106"
          stroke={shade(skin, 0.6)}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <Ellipse cx={75} cy={104} rx={7} ry={2.5} fill="#FF7A8A" opacity={fem ? 0.45 : 0.25} />
        <Ellipse cx={125} cy={104} rx={7} ry={2.5} fill="#FF7A8A" opacity={fem ? 0.45 : 0.25} />
        {fem ? (
          <Path
            d="M95 113 Q100 116 105 113"
            stroke="#B5485A"
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <Path
            d="M94 113 Q100 115.5 106 113"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        )}

        {cls === 'ladino' && (
          <Path
            d="M68 100 Q100 112 132 100 L130 116 Q116 130 100 131 Q84 130 70 116 Z"
            fill={shade(outfit, 0.45)}
            stroke={INK}
            strokeWidth={LINE}
            strokeLinejoin="round"
          />
        )}

        {/* ── Franja e mechas da frente ──────────────── */}
        <FrontHair style={hero.hair} color={hair} />

        {/* Bordas do capuz do necromante emoldurando o rosto */}
        {cls === 'necromante' && (
          <Path
            d="M56 100 Q52 30 100 26 Q148 30 144 100 L134 100 Q134 46 100 40 Q66 46 66 100 Z"
            fill={HOOD}
            stroke={INK}
            strokeWidth={LINE}
            strokeLinejoin="round"
          />
        )}
        {/* Galhada de folhas do druida */}
        {cls === 'druida' && (
          <G>
            <Path
              d="M72 42 L60 22 L54 26 M60 22 L62 12 M128 42 L140 22 L146 26 M140 22 L138 12"
              stroke={INK}
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M72 42 L60 22 L54 26 M60 22 L62 12 M128 42 L140 22 L146 26 M140 22 L138 12"
              stroke="#6B4423"
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
            />
            {[
              [54, 24],
              [62, 10],
              [146, 24],
              [138, 10],
            ].map(([x, y]) => (
              <Ellipse
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                rx={6}
                ry={3.5}
                fill="#66BB6A"
                stroke={INK}
                strokeWidth={1.2}
              />
            ))}
          </G>
        )}
        {/* Chapéu com pena do bardo */}
        {cls === 'bardo' && (
          <G>
            <Path
              d="M118 30 Q150 10 170 2 Q156 20 124 36 Z"
              fill="#E2465A"
              stroke={INK}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <Path
              d="M72 44 Q72 16 100 14 Q128 16 128 44 Z"
              fill={dark}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Rect x={72} y={36} width={56} height={7} fill={GOLD} stroke={INK} strokeWidth={1.4} />
            <Ellipse cx={100} cy={46} rx={50} ry={8} fill={dark} stroke={INK} strokeWidth={LINE} />
          </G>
        )}

        {/* ── Acessório ──────────────────────────────── */}
        {hero.accessory === 'faixa' && (
          <G>
            <Path
              d="M62 58 Q100 46 138 58 L138 67 Q100 55 62 67 Z"
              fill="#C8303C"
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path
              d="M136 60 L164 50 L156 62 L168 70 L138 66 Z"
              fill="#C8303C"
              stroke={INK}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
            <Rect
              x={92}
              y={52}
              width={16}
              height={10}
              rx={2}
              fill={METAL}
              stroke={INK}
              strokeWidth={1.4}
            />
          </G>
        )}
        {hero.accessory === 'elmo' && (
          <G>
            <Path
              d="M56 82 Q54 24 100 20 Q146 24 144 82 L134 82 Q132 46 100 44 Q68 46 66 82 Z"
              fill={METAL}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Path d="M100 20 Q138 24 144 82 L134 82 Q132 46 100 44 Z" fill="#000" opacity={0.12} />
            <Path
              d="M100 20 Q116 0 136 6 Q116 12 106 24 Z"
              fill="#C8303C"
              stroke={INK}
              strokeWidth={1.6}
            />
          </G>
        )}
        {hero.accessory === 'coroa' && (
          <G>
            <Path
              d="M72 46 L74 20 L88 36 L100 12 L112 36 L126 20 L128 46 Z"
              fill={GOLD}
              stroke={INK}
              strokeWidth={LINE}
              strokeLinejoin="round"
            />
            <Circle cx={100} cy={34} r={4} fill="#E2465A" stroke={INK} strokeWidth={1} />
            <Circle cx={84} cy={40} r={3} fill="#3D7BFF" stroke={INK} strokeWidth={1} />
            <Circle cx={116} cy={40} r={3} fill="#3D7BFF" stroke={INK} strokeWidth={1} />
          </G>
        )}
      </Svg>
    </View>
  );
}

function Eye({
  side,
  fem,
  iris,
  brow,
}: {
  side: 'left' | 'right';
  fem: boolean;
  iris: string;
  brow: string;
}) {
  // Desenhado para o olho esquerdo (x≈83) e espelhado para o direito.
  const m = (x: number) => (side === 'left' ? x : 200 - x);
  const p = (pts: [number, number][], cmd: string[]) =>
    pts.map(([x, y], i) => `${cmd[i]}${m(x)} ${y}`).join(' ');
  const sclera = p(
    [
      [70, 87],
      [80, 79],
      [95, 84],
      [93, 97],
      [82, 99],
      [72, 97],
      [70, 87],
    ],
    ['M', 'Q', '', 'Q', '', 'Q', ''],
  );
  return (
    <G>
      <Path d={sclera} fill="#FFFFFF" />
      <Ellipse cx={m(83)} cy={90} rx={8} ry={10} fill={iris} />
      <Ellipse cx={m(83)} cy={91} rx={3.4} ry={5} fill={INK} />
      <Circle cx={m(80)} cy={86} r={2.8} fill="#FFFFFF" />
      <Circle cx={m(86.5)} cy={95} r={1.4} fill="#FFFFFF" />
      {/* Cílio superior grosso, que dá o olhar de anime */}
      <Path
        d={`M${m(67)} 87 Q${m(78)} 76 ${m(97)} 82`}
        stroke={INK}
        strokeWidth={4.2}
        strokeLinecap="round"
        fill="none"
      />
      {fem && (
        <Path
          d={`M${m(68)} 86 L${m(62)} 81 M${m(70)} 83 L${m(66)} 77`}
          stroke={INK}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      )}
      <Path
        d={`M${m(73)} 98 Q${m(82)} 101 ${m(91)} 98`}
        stroke={INK}
        strokeWidth={1.2}
        opacity={0.55}
        fill="none"
      />
      <Path
        d={`M${m(70)} 74 Q${m(80)} 69 ${m(93)} 72`}
        stroke={brow}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

/** Volume de cabelo atrás da cabeça (antes do rosto). */
function BackHair({ style, color }: { style: string; color: string }) {
  const back = shade(color, 0.8);
  const common = { stroke: INK, strokeWidth: LINE, strokeLinejoin: 'round' as const };
  switch (style) {
    case 'raspado':
    case 'moicano':
    case 'longo':
      return null;
    case 'espetado':
      return (
        <Path
          d="M52 94 L38 62 L58 64 L42 32 L70 42 L64 10 L88 32 L100 0 L112 32 L136 10 L130 42 L158 32 L142 64 L162 62 L148 94 L138 72 L62 72 Z"
          fill={back}
          {...common}
        />
      );
    case 'coque':
      return (
        <G>
          <Circle cx={100} cy={22} r={15} fill={back} {...common} />
          <Path
            d="M56 86 Q48 40 100 24 Q152 40 144 86 Q144 100 138 112 L136 70 L64 70 L62 112 Q56 100 56 86 Z"
            fill={back}
            {...common}
          />
        </G>
      );
    default:
      return (
        <Path
          d="M56 86 Q48 40 100 24 Q152 40 144 86 Q144 100 138 112 L136 70 L64 70 L62 112 Q56 100 56 86 Z"
          fill={back}
          {...common}
        />
      );
  }
}

/** Franja em mechas pontudas, brilho e detalhes de cada estilo (depois do rosto). */
function FrontHair({ style, color }: { style: string; color: string }) {
  const common = { stroke: INK, strokeWidth: LINE, strokeLinejoin: 'round' as const };
  const strands = (
    <G opacity={0.55}>
      <Line x1={100} y1={32} x2={100} y2={62} stroke={shade(color, 0.6)} strokeWidth={1.3} />
      <Line x1={84} y1={36} x2={86} y2={64} stroke={shade(color, 0.6)} strokeWidth={1.3} />
      <Line x1={116} y1={36} x2={114} y2={64} stroke={shade(color, 0.6)} strokeWidth={1.3} />
    </G>
  );
  const shine = (
    <Path
      d="M76 42 Q100 32 124 42"
      stroke={tint(color, 0.45)}
      strokeWidth={3.5}
      strokeLinecap="round"
      fill="none"
      opacity={0.8}
    />
  );
  const bangs =
    'M60 80 L62 56 Q66 28 100 24 Q134 28 138 56 L140 80 L132 62 L128 75 L120 57 L114 73 L106 53 L100 70 L94 53 L86 73 L80 57 L72 75 L68 62 Z';

  switch (style) {
    case 'raspado':
      return (
        <G>
          <Path
            d="M64 68 Q64 32 100 28 Q136 32 136 68 Q120 54 100 54 Q80 54 64 68 Z"
            fill={shade(color, 0.9)}
            {...common}
          />
          <Path
            d="M80 40 Q100 34 120 40"
            stroke={tint(color, 0.35)}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            opacity={0.6}
          />
        </G>
      );
    case 'moicano':
      return (
        <G>
          <Path
            d="M64 68 Q64 32 100 28 Q136 32 136 68 Q120 54 100 54 Q80 54 64 68 Z"
            fill={shade(color, 0.85)}
            opacity={0.7}
            {...common}
          />
          <Path
            d="M86 58 L88 10 L100 30 L106 0 L114 30 L126 12 L118 60 Z"
            fill={color}
            {...common}
          />
          <Path
            d="M100 30 L104 52"
            stroke={tint(color, 0.45)}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </G>
      );
    case 'longo':
      return (
        <G>
          <Path d={bangs} fill={color} {...common} />
          <Path d="M62 74 L56 132 L65 120 L70 136 L74 86 Z" fill={color} {...common} />
          <Path d="M138 74 L144 132 L135 120 L130 136 L126 86 Z" fill={color} {...common} />
          {strands}
          {shine}
        </G>
      );
    case 'espetado':
      return (
        <G>
          <Path
            d="M58 80 L60 54 Q66 26 100 22 Q134 26 140 54 L142 80 L130 60 L128 76 L118 54 L112 74 L104 48 L98 71 L90 48 L84 74 L76 56 L70 76 L66 60 Z"
            fill={color}
            {...common}
          />
          {strands}
          {shine}
        </G>
      );
    case 'tranca':
      return (
        <G>
          <Path d={bangs} fill={color} {...common} />
          {[112, 128, 144, 160].map((y, i) => (
            <Ellipse
              key={y}
              cx={142 + i * 2}
              cy={y}
              rx={7}
              ry={9}
              fill={i % 2 ? shade(color, 0.85) : color}
              {...common}
            />
          ))}
          <Rect
            x={139}
            y={168}
            width={16}
            height={6}
            rx={2}
            fill="#C8303C"
            stroke={INK}
            strokeWidth={1.4}
          />
          {strands}
          {shine}
        </G>
      );
    default:
      return (
        <G>
          <Path d={bangs} fill={color} {...common} />
          {strands}
          {shine}
          {style === 'coque' && (
            <Path d="M88 18 L114 26" stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
          )}
        </G>
      );
  }
}
