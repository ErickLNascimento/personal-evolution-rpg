import { HERO_SLOTS, MAX_TIER } from '@per/domain';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

/**
 * Efeito da aura: desenhado por shader atrás do herói, maior que ele e em "pixels" do mesmo
 * tamanho do sprite, com um movimento próprio para cada aura.
 *   0 brasas subindo · 1 ondas no chão · 2 relâmpagos · 3 orbes girando · 4 raios de sol ·
 *   5 flocos/pétalas caindo · 6 fumaça sombria
 */
const STYLE: Record<string, number> = {
  brasa: 0,
  mare: 1,
  relampago: 2,
  eclipse: 3,
  solar: 4,
  'loja-aura-gelo': 5,
  'loja-aura-rubi': 3,
  'loja-aura-esmeralda': 0,
  'loja-aura-sakura': 5,
  'loja-aura-sombra': 6,
};

/** Aura do estágio lendário, quando nenhuma foi escolhida. */
const LEGENDARY = { style: 4, color: '#FFD36B' };

const AURA_FX = Skia.RuntimeEffect.Make(`
uniform float2 res;
uniform float2 feet;
uniform float bodyH;
uniform float time;
uniform float3 color;
uniform float fx;
uniform float px;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

half4 main(float2 xy) {
  if (xy.x > res.x || xy.y > res.y) { return half4(0); }
  float2 p = floor(xy / px) * px + px * 0.5;
  float2 c = float2(feet.x, feet.y - bodyH * 0.48);
  float2 d = (p - c) / float2(bodyH * 0.40, bodyH * 0.62);
  float r = length(d);
  float pulse = 0.72 + 0.28 * sin(time * 2.6);
  float3 col = color;
  // Brilho de base, em degraus (cara de pixel art).
  float a = floor(clamp(1.15 - r, 0.0, 1.0) * 0.55 * pulse * 6.0) / 6.0;
  int s = int(fx + 0.5);
  float top = feet.y - bodyH * 1.2;

  if (s == 0 || s == 6) {
    // Partículas subindo (brasas) ou fumaça (maiores, lentas e escuras).
    float cell = px * (s == 6 ? 4.0 : 3.0);
    float gx = floor(p.x / cell);
    float h = hash(float2(gx, 7.0));
    float speed = s == 6 ? 0.18 + h * 0.15 : 0.35 + h * 0.45;
    float y = fract(time * speed + h);
    float py = feet.y - y * bodyH * 1.25;
    float sway = sin(time * 3.0 + h * 6.283) * px * (s == 6 ? 2.0 : 1.0);
    float sz = px * (s == 6 ? 1.6 : 0.6) * (1.0 - y * 0.5);
    float alive = step(0.35, hash(float2(gx, 3.0))) * step(abs(p.x - feet.x), bodyH * 0.55);
    float hit = step(abs(p.x - ((gx + 0.5) * cell + sway)), sz) * step(abs(p.y - py), sz) * alive;
    float fade = 1.0 - y;
    a = max(a, hit * fade);
    if (s == 0) col = mix(color, float3(1.0, 0.95, 0.65), hit * (1.0 - y));
    else col = mix(color, float3(0.08, 0.04, 0.14), hit * 0.5);
  } else if (s == 1) {
    // Ondas que saem dos pés, achatadas como no chão, e bolhas subindo.
    float2 q = (p - feet) / float2(bodyH * 0.62, bodyH * 0.16);
    float rr = length(q);
    float ring = fract(rr * 0.9 - time * 0.7);
    float band = step(0.82, ring) * step(rr, 1.7) * (1.0 - rr / 1.7);
    a = max(a, band);
    float gx = floor(p.x / (px * 4.0));
    float h = hash(float2(gx, 11.0));
    float y = fract(time * (0.3 + h * 0.3) + h);
    float py = feet.y - y * bodyH;
    float b = step(length(p - float2((gx + 0.5) * px * 4.0, py)), px * 0.9) * step(0.6, h) * step(abs(p.x - feet.x), bodyH * 0.45);
    a = max(a, b * (1.0 - y));
  } else if (s == 2) {
    // Relâmpagos que aparecem e somem; o brilho acende junto.
    float slot = floor(time * 3.0);
    float flash = 1.0 - fract(time * 3.0);
    for (int k = 0; k < 2; k++) {
      float seed = slot * 13.0 + float(k) * 7.0;
      float on = step(0.45, hash(float2(seed, 1.0)));
      float bx = feet.x + (hash(float2(seed, 2.0)) - 0.5) * bodyH * 0.95;
      float seg = floor(p.y / (px * 3.0));
      float jag = (hash(float2(seg, seed)) - 0.5) * px * 5.0;
      float inY = step(top, p.y) * step(p.y, feet.y);
      float bolt = step(abs(p.x - bx - jag), px * 0.7) * on * inY;
      a = max(a, bolt * flash);
      col = mix(col, float3(1.0, 1.0, 0.85), bolt * flash);
      a = max(a, on * flash * 0.25 * step(r, 1.0));
    }
  } else if (s == 3) {
    // Orbes girando em volta do corpo, com rastro.
    for (int k = 0; k < 3; k++) {
      for (int t = 0; t < 4; t++) {
        float ang = time * 1.6 + float(k) * 2.094 - float(t) * 0.16;
        float2 pos = c + float2(cos(ang) * bodyH * 0.46, sin(ang) * bodyH * 0.14 - bodyH * 0.06);
        float o = step(length(p - pos), px * (1.6 - float(t) * 0.35));
        a = max(a, o * (1.0 - float(t) * 0.25));
      }
    }
  } else if (s == 4) {
    // Raios girando, como um sol atrás do herói.
    float ang = atan(d.y, d.x);
    float rays = step(0.72, fract(ang / 6.2832 * 12.0 + time * 0.12));
    a = max(a, rays * step(0.45, r) * step(r, 1.45) * (1.5 - r) * 0.7 * pulse);
    col = mix(color, float3(1.0, 0.98, 0.8), step(r, 0.6) * 0.4);
  } else if (s == 5) {
    // Flocos ou pétalas caindo, balançando.
    float cell = px * 3.0;
    float gx = floor(p.x / cell);
    float h = hash(float2(gx, 5.0));
    float y = fract(time * (0.18 + h * 0.2) + h);
    float py = top + y * bodyH * 1.3;
    float sway = sin(time * 2.0 + h * 9.0) * px * 2.0;
    float alive = step(0.4, hash(float2(gx, 9.0))) * step(abs(p.x - feet.x), bodyH * 0.6);
    float hit = step(abs(p.x - ((gx + 0.5) * cell + sway)), px * 0.7) * step(abs(p.y - py), px * 0.7) * alive;
    a = max(a, hit * (1.0 - y * 0.6));
    col = mix(color, float3(1.0), hit * 0.35);
  }
  a = clamp(a, 0.0, 0.95);
  return half4(col * a, a);
}
`)!;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Estilo e cor da aura do herói, ou null sem aura. */
export function auraFxFor(aura: string, tier: number | undefined): { style: number; color: string } | null {
  if (aura === 'nenhuma') return tier === MAX_TIER ? LEGENDARY : null;
  const item = HERO_SLOTS.aura.items.find((i) => i.id === aura);
  if (!item?.color) return null;
  return { style: STYLE[aura] ?? 0, color: item.color };
}

/**
 * Camada da aura atrás do herói. `width`/`height` são as do herói; o efeito sai para fora
 * (posição absoluta). Parado (`animated` falso), mostra um quadro fixo: serve de prévia.
 */
export function AuraFx({
  aura,
  tier,
  width,
  height,
  boxWidth = width,
  boxHeight = height,
  animated,
}: {
  aura: string;
  tier?: number;
  width: number;
  height: number;
  /** Caixa onde o herói está (centralizado na largura, apoiado embaixo). */
  boxWidth?: number;
  boxHeight?: number;
  animated: boolean;
}) {
  const fx = useMemo(() => auraFxFor(aura, tier), [aura, tier]);
  const time = useSharedValue(1.3);
  // O relógio só roda com aura e animação (miniaturas ficam paradas e não gastam quadros).
  const clock = useFrameCallback((info) => {
    'worklet';
    time.set((info.timeSinceFirstFrame ?? 0) / 1000 + 1.3);
  }, false);
  const running = animated && fx !== null;
  useEffect(() => {
    clock.setActive(running);
  }, [clock, running]);
  const W = Math.round(width * 1.9);
  const H = Math.round(height * 1.35);
  const left = (boxWidth - W) / 2;
  const top = boxHeight - H + height * 0.06;
  // Um "pixel" do efeito tem o tamanho de um pixel do sprite (o herói tem 34 de largura).
  const px = Math.max(1, width / 34);
  const rgb = useMemo(() => (fx ? hexToRgb(fx.color) : ([0, 0, 0] as const)), [fx]);
  const uniforms = useDerivedValue(() => ({
    res: [W, H],
    feet: [W / 2, H - height * 0.08],
    bodyH: height,
    time: time.get(),
    color: rgb,
    fx: fx?.style ?? 0,
    px,
  }));
  if (!fx) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { left, top, width: W, height: H }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Canvas style={{ width: W, height: H }}>
        <Fill>
          <Shader source={AURA_FX} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
});
