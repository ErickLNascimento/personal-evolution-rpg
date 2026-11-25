import { Canvas, FilterMode, ImageShader, MipmapMode, Rect } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSkiaImage } from '@/components/sprites/useSkiaImage';

/**
 * Chefes da semana em pixel art 64x64, gerados por tools/sprites/gen_bosses.py e
 * gen_boss_sombra.py. Cada chefe tem 5 animações:
 *   idle (loop) · taunt (provocação) · hit (golpe: missão feita) · weak (loop, pouca vida) ·
 *   defeat (dissolve e vira estrela; fica no último frame).
 */
export type BossAnim = 'idle' | 'taunt' | 'hit' | 'weak' | 'defeat';

type SheetMeta = {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  loop: boolean;
};
type Sheet = [number, SheetMeta];

const SHEETS: Record<string, Record<BossAnim, Sheet>> = {
  golem: {
    idle: [
      require('../../../assets/sprites/bosses/golem_idle.png'),
      require('../../../assets/sprites/bosses/golem_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/golem_taunt.png'),
      require('../../../assets/sprites/bosses/golem_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/golem_hit.png'),
      require('../../../assets/sprites/bosses/golem_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/golem_weak.png'),
      require('../../../assets/sprites/bosses/golem_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/golem_defeat.png'),
      require('../../../assets/sprites/bosses/golem_defeat.json'),
    ],
  },
  hidra: {
    idle: [
      require('../../../assets/sprites/bosses/hidra_idle.png'),
      require('../../../assets/sprites/bosses/hidra_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/hidra_taunt.png'),
      require('../../../assets/sprites/bosses/hidra_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/hidra_hit.png'),
      require('../../../assets/sprites/bosses/hidra_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/hidra_weak.png'),
      require('../../../assets/sprites/bosses/hidra_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/hidra_defeat.png'),
      require('../../../assets/sprites/bosses/hidra_defeat.json'),
    ],
  },
  lich: {
    idle: [
      require('../../../assets/sprites/bosses/lich_idle.png'),
      require('../../../assets/sprites/bosses/lich_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/lich_taunt.png'),
      require('../../../assets/sprites/bosses/lich_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/lich_hit.png'),
      require('../../../assets/sprites/bosses/lich_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/lich_weak.png'),
      require('../../../assets/sprites/bosses/lich_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/lich_defeat.png'),
      require('../../../assets/sprites/bosses/lich_defeat.json'),
    ],
  },
  dragao: {
    idle: [
      require('../../../assets/sprites/bosses/dragao_idle.png'),
      require('../../../assets/sprites/bosses/dragao_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/dragao_taunt.png'),
      require('../../../assets/sprites/bosses/dragao_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/dragao_hit.png'),
      require('../../../assets/sprites/bosses/dragao_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/dragao_weak.png'),
      require('../../../assets/sprites/bosses/dragao_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/dragao_defeat.png'),
      require('../../../assets/sprites/bosses/dragao_defeat.json'),
    ],
  },
  sombra: {
    idle: [
      require('../../../assets/sprites/bosses/sombra_idle.png'),
      require('../../../assets/sprites/bosses/sombra_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/sombra_taunt.png'),
      require('../../../assets/sprites/bosses/sombra_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/sombra_hit.png'),
      require('../../../assets/sprites/bosses/sombra_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/sombra_weak.png'),
      require('../../../assets/sprites/bosses/sombra_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/sombra_defeat.png'),
      require('../../../assets/sprites/bosses/sombra_defeat.json'),
    ],
  },
  basilisco: {
    idle: [
      require('../../../assets/sprites/bosses/basilisco_idle.png'),
      require('../../../assets/sprites/bosses/basilisco_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/basilisco_taunt.png'),
      require('../../../assets/sprites/bosses/basilisco_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/basilisco_hit.png'),
      require('../../../assets/sprites/bosses/basilisco_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/basilisco_weak.png'),
      require('../../../assets/sprites/bosses/basilisco_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/basilisco_defeat.png'),
      require('../../../assets/sprites/bosses/basilisco_defeat.json'),
    ],
  },
};

let runSerial = 0;

/**
 * Toca uma animação do chefe. Animações sem loop ficam no último frame e chamam `onEnd`.
 * Trocar `anim` (ou `playKey`) recomeça do frame 0 sem remontar o canvas.
 */
export function BossSprite({
  id,
  anim = 'idle',
  size = 96,
  playKey = 0,
  onEnd,
}: {
  id: string;
  anim?: BossAnim;
  size?: number;
  /** Muda para tocar de novo a mesma animação (ex.: outro golpe). */
  playKey?: number;
  onEnd?: () => void;
}) {
  const sheets = SHEETS[id] ?? SHEETS.sombra!;
  const [source, meta] = sheets[anim];
  const img = useSkiaImage(source);
  const { frameCount, fps, loop } = meta;

  const runKey = `${id}-${anim}-${playKey}`;
  const [run, setRun] = useState(() => ({ key: runKey, id: ++runSerial }));
  if (run.key !== runKey) setRun({ key: runKey, id: ++runSerial });
  const runId = run.id;

  const frame = useSharedValue(0);
  const start = useSharedValue(-1);
  const done = useSharedValue(false);
  const currentRun = useSharedValue(runId);

  useFrameCallback((info) => {
    'worklet';
    if (currentRun.get() !== runId) {
      currentRun.set(runId);
      start.set(info.timestamp);
      done.set(false);
      frame.set(0);
    }
    if (done.get()) return;
    if (start.get() < 0) start.set(info.timestamp);
    const f = Math.floor(((info.timestamp - start.get()) * fps) / 1000);
    if (loop) frame.set(f % frameCount);
    else if (f >= frameCount) {
      frame.set(frameCount - 1);
      done.set(true);
      if (onEnd) scheduleOnRN(onEnd);
    } else frame.set(f);
  });

  // A tira de frames anda para a esquerda: o quadro visível é o do frame atual.
  const x = useDerivedValue(() => -Math.min(frame.get(), frameCount - 1) * size);

  // Pintado como o herói: um retângulo preenchido pela imagem (ImageShader), não um nó Image.
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {img && (
          <Rect x={0} y={0} width={size} height={size}>
            <ImageShader
              image={img}
              x={x}
              y={0}
              width={size * frameCount}
              height={size}
              fit="fill"
              sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
            />
          </Rect>
        )}
      </Canvas>
    </View>
  );
}

/**
 * Qual animação mostrar: a de base vem da vida do chefe (derrotado → defeat, pouca vida → weak,
 * senão idle); `taunt` e `hit` tocam uma vez por cima e voltam para a base.
 */
export function useBossAnim(
  state: { maxHp: number; hp: number; defeated: boolean },
  opts: { tauntOnMount?: boolean; hits?: number } = {},
) {
  const base: BossAnim = state.defeated
    ? 'defeat'
    : state.maxHp > 0 && state.hp / state.maxHp < 0.3
      ? 'weak'
      : 'idle';
  const fullHp = state.maxHp > 0 && state.hp === state.maxHp;
  const [overlay, setOverlay] = useState<BossAnim | null>(
    opts.tauntOnMount && fullHp ? 'taunt' : null,
  );
  const [seenHits, setSeenHits] = useState(opts.hits ?? 0);
  const [hitKey, setHitKey] = useState(0);
  if ((opts.hits ?? 0) !== seenHits) {
    setSeenHits(opts.hits ?? 0);
    if ((opts.hits ?? 0) > seenHits && !state.defeated) {
      setOverlay('hit');
      setHitKey((k) => k + 1);
    }
  }
  const anim = overlay ?? base;
  return {
    anim,
    playKey: hitKey,
    onEnd: overlay ? () => setOverlay(null) : undefined,
  };
}
