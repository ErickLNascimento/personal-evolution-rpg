import { MAX_TIER, type HeroLook } from '@per/domain';
import {
  Canvas,
  Fill,
  FilterMode,
  ImageShader,
  loadData,
  MipmapMode,
  Shader,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SPRITE_PALETTE_SIZE, spritePalette } from './spritePalette';

type AtlasMeta = {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  indexStep: number;
  /** Camada → [coluna, linha] do atlas (as camadas ficam em colunas de até 60 linhas). */
  layers: Record<string, [number, number]>;
};

export type PixelHeroAnim = 'idle' | 'celebrate' | 'levelup';

/** Um atlas por animação (gerados por tools/sprites/gen_hero.py). */
const ATLASES: Record<PixelHeroAnim, { image: number; meta: AtlasMeta }> = {
  idle: {
    image: require('../../../assets/sprites/hero/hero_idle.png'),
    meta: require('../../../assets/sprites/hero/hero_idle.json'),
  },
  celebrate: {
    image: require('../../../assets/sprites/hero/hero_celebrate.png'),
    meta: require('../../../assets/sprites/hero/hero_celebrate.json'),
  },
  levelup: {
    image: require('../../../assets/sprites/hero/hero_levelup.png'),
    meta: require('../../../assets/sprites/hero/hero_levelup.json'),
  },
};

// Cada atlas é decodificado uma vez só e compartilhado por todos os heróis na tela
// (a tela do Herói mostra 11 miniaturas; decodificar um por instância gastaria ~6 MB cada).
const loading = new Map<PixelHeroAnim, Promise<SkImage | null>>();
const loaded = new Map<PixelHeroAnim, SkImage>();

function loadAtlas(anim: PixelHeroAnim): Promise<SkImage | null> {
  let p = loading.get(anim);
  if (!p) {
    p = loadData(ATLASES[anim].image, (d) => Skia.Image.MakeImageFromEncoded(d))
      // Falha de rede (ex.: Metro reiniciando) vira null, para poder tentar de novo.
      .catch(() => null)
      .then((img) => {
        if (img) loaded.set(anim, img);
        else loading.delete(anim); // tenta de novo na próxima montagem
        return img;
      });
    loading.set(anim, p);
  }
  return p;
}

const ALL_ANIMS = Object.keys(ATLASES) as PixelHeroAnim[];

/** Começa a decodificar todos os atlas já: na hora de comemorar, o atlas está pronto. */
function preloadAtlases(): Promise<unknown> {
  return Promise.all(ALL_ANIMS.map(loadAtlas));
}

/** Atlas já decodificados; re-renderiza quando algum termina de carregar. */
function useLoadedAtlases(): ReadonlyMap<PixelHeroAnim, SkImage> {
  const [, setVersion] = useState(0);
  const missing = ALL_ANIMS.some((a) => !loaded.has(a));
  useEffect(() => {
    if (!missing) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Se algum atlas falhar, tenta de novo sozinho (com espera crescente) enquanto montado.
    const attempt = (n: number) => {
      void preloadAtlases().then(() => {
        if (!alive) return;
        setVersion((v) => v + 1);
        if (ALL_ANIMS.some((a) => !loaded.has(a)))
          timer = setTimeout(() => attempt(n + 1), Math.min(10000, 800 * 2 ** n));
      });
    };
    attempt(0);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [missing]);
  return loaded;
}

const MAX_LAYERS = 12;

/** Recorte do frame 48x48 que contém o herói (sem a margem vazia dos lados). */
const CROP = { x: 7, y: 1, w: 34, h: 47 };
export const PIXEL_HERO_ASPECT = CROP.h / CROP.w;

/** Camadas do visual, de trás para frente. Camadas que não existem no atlas são ignoradas. */
export function heroLayers(hero: HeroLook): string[] {
  const { heroClass: cls, form, hair, accessory, aura } = hero;
  const kit = hero.kit ?? cls;
  // No estágio lendário (5) o herói ganha aura própria, mesmo sem escolher uma.
  const hasAura = aura !== 'nenhuma' || hero.tier === MAX_TIER;
  return [
    'shadow',
    ...(hasAura ? [`aura/${form}`] : []),
    'fxback',
    ...(accessory === 'capa' ? ['cape'] : []),
    `hairback/${hair}/${form}`,
    `classback/${kit}`,
    `body/${cls}/${form}`,
    `hair/${hair}/${form}`,
    `race/${hero.race ?? 'humano'}/${form}`,
    `headgear/${kit}`,
    `accessory/${accessory}`,
    `weapon/${kit}/${form}`,
  ];
}

// Para cada pixel, percorre as camadas de trás para frente: a última com cor nesse ponto
// vence, e o índice gravado no canal R vira a cor da paleta. Só a sombra (a camada de
// trás) é semitransparente, então não é preciso misturar camadas.
// (SkSL só aceita indexar arrays pelo contador do loop.)
const LAYERED_PALETTE = Skia.RuntimeEffect.Make(`
uniform shader sheet;
uniform float frame;
uniform float frameW;
uniform float frameH;
uniform float scale;
uniform float cropX;
uniform float cropY;
uniform float indexStep;
uniform float frameCount;
uniform float layerCount;
uniform float cols[${MAX_LAYERS}];
uniform float rows[${MAX_LAYERS}];
uniform float4 palette[${SPRITE_PALETTE_SIZE}];

half4 main(float2 xy) {
  float2 p = floor(xy / scale) + float2(cropX, cropY);
  if (p.x < 0.0 || p.y < 0.0 || p.x >= frameW || p.y >= frameH) { return half4(0); }
  int idx = 0;
  for (int i = 0; i < ${MAX_LAYERS}; i++) {
    if (float(i) < layerCount) {
      half4 s = sheet.eval(float2((cols[i] * frameCount + frame) * frameW + p.x + 0.5, rows[i] * frameH + p.y + 0.5));
      if (s.a > 0.5) { idx = int(floor(s.r / s.a * 255.0 / indexStep + 0.5)); }
    }
  }
  float4 col = float4(0);
  for (int j = 1; j < ${SPRITE_PALETTE_SIZE}; j++) {
    if (j == idx) { col = palette[j]; }
  }
  return half4(col.rgb * col.a, col.a);
}
`)!;

type Props = {
  hero: HeroLook;
  /** Largura em dp; a altura segue PIXEL_HERO_ASPECT. */
  size: number;
  anim?: PixelHeroAnim;
  /** false = fica parado no primeiro frame (miniaturas). */
  playing?: boolean;
  /** Chamado quando uma animação sem loop chega ao último frame. */
  onEnd?: () => void;
};

let animSerial = 0;

export function PixelHero({ hero, size, anim = 'idle', playing = true, onEnd }: Props) {
  const atlases = useLoadedAtlases();
  // Enquanto a animação pedida não carregou, segue mostrando a que já está pronta
  // (nunca um quadro vazio). O mesmo canvas é reaproveitado: trocar de animação não remonta.
  const [shownAnim, setShownAnim] = useState<PixelHeroAnim>(anim);
  if (anim !== shownAnim && atlases.has(anim)) setShownAnim(anim);
  const shown = atlases.has(shownAnim) ? shownAnim : [...atlases.keys()][0];
  const img = shown ? atlases.get(shown)! : null;
  const meta = ATLASES[shown ?? 'idle'].meta;
  const { frameWidth, frameHeight, frameCount, fps, loop, indexStep } = meta;
  const scale = size / CROP.w;
  const height = Math.round(size * PIXEL_HERO_ASPECT);
  const isPlaying = playing && shown === anim;

  // Identifica cada "rodada" de animação; o callback de frame zera o relógio quando ela muda.
  const [run, setRun] = useState(() => ({ key: `${shown}-${isPlaying}`, id: ++animSerial }));
  const runKey = `${shown}-${isPlaying}`;
  if (run.key !== runKey) setRun({ key: runKey, id: ++animSerial });
  const runId = run.id;

  const palette = useMemo(() => spritePalette(hero), [hero]);
  const rows = useMemo(() => {
    const found = heroLayers(hero)
      .map((name) => meta.layers[name])
      .filter((v): v is [number, number] => v !== undefined)
      .slice(0, MAX_LAYERS);
    const pad = (xs: number[]) => [...xs, ...Array<number>(MAX_LAYERS - xs.length).fill(0)];
    return {
      count: found.length,
      cols: pad(found.map(([c]) => c)),
      rows: pad(found.map(([, r]) => r)),
    };
  }, [hero, meta]);

  const frame = useSharedValue(0);
  const start = useSharedValue(-1);
  const done = useSharedValue(false);
  const currentRun = useSharedValue(runId);

  useFrameCallback((info) => {
    'worklet';
    if (currentRun.get() !== runId) {
      // Nova rodada (outra animação, ou play/pause): recomeça do frame 0.
      currentRun.set(runId);
      start.set(info.timestamp);
      done.set(false);
      frame.set(0);
    }
    if (!isPlaying) {
      if (frame.get() !== 0) frame.set(0);
      return;
    }
    if (done.get()) return;
    if (start.get() < 0) start.set(info.timestamp);
    const f = Math.floor(((info.timestamp - start.get()) * fps) / 1000);
    if (loop) {
      frame.set(f % frameCount);
    } else if (f >= frameCount) {
      frame.set(frameCount - 1);
      done.set(true);
      if (onEnd) scheduleOnRN(onEnd);
    } else {
      frame.set(f);
    }
  });

  const uniforms = useDerivedValue(() => ({
    // Limita ao tamanho desta animação: no instante da troca o frame pode ser o da anterior.
    frame: Math.min(frame.get(), frameCount - 1),
    frameW: frameWidth,
    frameH: frameHeight,
    scale,
    cropX: CROP.x,
    cropY: CROP.y,
    indexStep,
    frameCount,
    layerCount: rows.count,
    cols: rows.cols,
    rows: rows.rows,
    palette,
  }));

  const style = { width: size, height };
  if (!img) return <Canvas style={style} />;

  return (
    <Canvas style={style}>
      <Fill>
        <Shader source={LAYERED_PALETTE} uniforms={uniforms}>
          <ImageShader
            image={img}
            x={0}
            y={0}
            width={img.width()}
            height={img.height()}
            fit="fill"
            sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
          />
        </Shader>
      </Fill>
    </Canvas>
  );
}

// Decodifica os atlas assim que o app carrega este módulo, antes da primeira tela com herói.
void preloadAtlases();
