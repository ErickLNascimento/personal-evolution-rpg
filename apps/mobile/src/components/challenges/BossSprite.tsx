import { Canvas, ColorMatrix, FilterMode, ImageShader, MipmapMode, Rect } from '@shopify/react-native-skia';
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
  // Ato II (tools/sprites/gen_bosses_act2.py)
  kraken: {
    idle: [
      require('../../../assets/sprites/bosses/kraken_idle.png'),
      require('../../../assets/sprites/bosses/kraken_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/kraken_taunt.png'),
      require('../../../assets/sprites/bosses/kraken_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/kraken_hit.png'),
      require('../../../assets/sprites/bosses/kraken_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/kraken_weak.png'),
      require('../../../assets/sprites/bosses/kraken_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/kraken_defeat.png'),
      require('../../../assets/sprites/bosses/kraken_defeat.json'),
    ],
  },
  quimera: {
    idle: [
      require('../../../assets/sprites/bosses/quimera_idle.png'),
      require('../../../assets/sprites/bosses/quimera_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/quimera_taunt.png'),
      require('../../../assets/sprites/bosses/quimera_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/quimera_hit.png'),
      require('../../../assets/sprites/bosses/quimera_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/quimera_weak.png'),
      require('../../../assets/sprites/bosses/quimera_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/quimera_defeat.png'),
      require('../../../assets/sprites/bosses/quimera_defeat.json'),
    ],
  },
  banshee: {
    idle: [
      require('../../../assets/sprites/bosses/banshee_idle.png'),
      require('../../../assets/sprites/bosses/banshee_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/banshee_taunt.png'),
      require('../../../assets/sprites/bosses/banshee_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/banshee_hit.png'),
      require('../../../assets/sprites/bosses/banshee_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/banshee_weak.png'),
      require('../../../assets/sprites/bosses/banshee_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/banshee_defeat.png'),
      require('../../../assets/sprites/bosses/banshee_defeat.json'),
    ],
  },
  vampiro: {
    idle: [
      require('../../../assets/sprites/bosses/vampiro_idle.png'),
      require('../../../assets/sprites/bosses/vampiro_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/vampiro_taunt.png'),
      require('../../../assets/sprites/bosses/vampiro_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/vampiro_hit.png'),
      require('../../../assets/sprites/bosses/vampiro_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/vampiro_weak.png'),
      require('../../../assets/sprites/bosses/vampiro_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/vampiro_defeat.png'),
      require('../../../assets/sprites/bosses/vampiro_defeat.json'),
    ],
  },
  mimico: {
    idle: [
      require('../../../assets/sprites/bosses/mimico_idle.png'),
      require('../../../assets/sprites/bosses/mimico_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/mimico_taunt.png'),
      require('../../../assets/sprites/bosses/mimico_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/mimico_hit.png'),
      require('../../../assets/sprites/bosses/mimico_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/mimico_weak.png'),
      require('../../../assets/sprites/bosses/mimico_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/mimico_defeat.png'),
      require('../../../assets/sprites/bosses/mimico_defeat.json'),
    ],
  },
  medusa: {
    idle: [
      require('../../../assets/sprites/bosses/medusa_idle.png'),
      require('../../../assets/sprites/bosses/medusa_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/medusa_taunt.png'),
      require('../../../assets/sprites/bosses/medusa_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/medusa_hit.png'),
      require('../../../assets/sprites/bosses/medusa_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/medusa_weak.png'),
      require('../../../assets/sprites/bosses/medusa_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/medusa_defeat.png'),
      require('../../../assets/sprites/bosses/medusa_defeat.json'),
    ],
  },
  // Minichefes das emboscadas (tools/sprites/gen_minis.py)
  goblin: {
    idle: [
      require('../../../assets/sprites/bosses/goblin_idle.png'),
      require('../../../assets/sprites/bosses/goblin_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/goblin_taunt.png'),
      require('../../../assets/sprites/bosses/goblin_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/goblin_hit.png'),
      require('../../../assets/sprites/bosses/goblin_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/goblin_weak.png'),
      require('../../../assets/sprites/bosses/goblin_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/goblin_defeat.png'),
      require('../../../assets/sprites/bosses/goblin_defeat.json'),
    ],
  },
  slime: {
    idle: [
      require('../../../assets/sprites/bosses/slime_idle.png'),
      require('../../../assets/sprites/bosses/slime_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/slime_taunt.png'),
      require('../../../assets/sprites/bosses/slime_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/slime_hit.png'),
      require('../../../assets/sprites/bosses/slime_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/slime_weak.png'),
      require('../../../assets/sprites/bosses/slime_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/slime_defeat.png'),
      require('../../../assets/sprites/bosses/slime_defeat.json'),
    ],
  },
  morcego: {
    idle: [
      require('../../../assets/sprites/bosses/morcego_idle.png'),
      require('../../../assets/sprites/bosses/morcego_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/morcego_taunt.png'),
      require('../../../assets/sprites/bosses/morcego_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/morcego_hit.png'),
      require('../../../assets/sprites/bosses/morcego_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/morcego_weak.png'),
      require('../../../assets/sprites/bosses/morcego_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/morcego_defeat.png'),
      require('../../../assets/sprites/bosses/morcego_defeat.json'),
    ],
  },
  diabrete: {
    idle: [
      require('../../../assets/sprites/bosses/diabrete_idle.png'),
      require('../../../assets/sprites/bosses/diabrete_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/diabrete_taunt.png'),
      require('../../../assets/sprites/bosses/diabrete_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/diabrete_hit.png'),
      require('../../../assets/sprites/bosses/diabrete_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/diabrete_weak.png'),
      require('../../../assets/sprites/bosses/diabrete_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/diabrete_defeat.png'),
      require('../../../assets/sprites/bosses/diabrete_defeat.json'),
    ],
  },
  esqueleto: {
    idle: [
      require('../../../assets/sprites/bosses/esqueleto_idle.png'),
      require('../../../assets/sprites/bosses/esqueleto_idle.json'),
    ],
    taunt: [
      require('../../../assets/sprites/bosses/esqueleto_taunt.png'),
      require('../../../assets/sprites/bosses/esqueleto_taunt.json'),
    ],
    hit: [
      require('../../../assets/sprites/bosses/esqueleto_hit.png'),
      require('../../../assets/sprites/bosses/esqueleto_hit.json'),
    ],
    weak: [
      require('../../../assets/sprites/bosses/esqueleto_weak.png'),
      require('../../../assets/sprites/bosses/esqueleto_weak.json'),
    ],
    defeat: [
      require('../../../assets/sprites/bosses/esqueleto_defeat.png'),
      require('../../../assets/sprites/bosses/esqueleto_defeat.json'),
    ],
  },
};

/**
 * Tonalidade do chefe: a cor da patente (Capitão aço, General vermelho escuro, Lorde dourado) ou a
 * silhueta do bestiário (chefe nunca vencido). Filtro de cor 4×5 sobre o sprite, sem folhas novas.
 */
export type BossTint = 'capitao' | 'general' | 'lorde' | 'silhouette';

const LUMA = [0.2126, 0.7152, 0.0722] as const;
/** Mistura com o cinza (s = quanto da cor original fica) e ganho por canal. */
function tintMatrix(s: number, gains: readonly [number, number, number], add = [0, 0, 0]): number[] {
  const rows: number[] = [];
  gains.forEach((g, i) => {
    const row = LUMA.map((l, j) => (1 - s) * l * g + (i === j ? s * g : 0));
    rows.push(...row, 0, add[i] ?? 0);
  });
  return [...rows, 0, 0, 0, 1, 0];
}

const TINTS: Record<BossTint, number[]> = {
  capitao: tintMatrix(0.35, [0.92, 1.0, 1.18]),
  general: tintMatrix(0.55, [0.85, 0.62, 0.7]),
  lorde: tintMatrix(0.45, [1.3, 1.08, 0.55], [0.04, 0.02, 0]),
  silhouette: [0, 0, 0, 0, 0.26, 0, 0, 0, 0, 0.27, 0, 0, 0, 0, 0.33, 0, 0, 0, 1, 0],
};

/** Tonalidade de cada patente (Soldado = cores originais). */
export const RANK_TINT: readonly (BossTint | null)[] = [null, 'capitao', 'general', 'lorde'];

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
  tint = null,
}: {
  id: string;
  anim?: BossAnim;
  size?: number;
  /** Muda para tocar de novo a mesma animação (ex.: outro golpe). */
  playKey?: number;
  onEnd?: () => void;
  /** Cor da patente ou silhueta; null = cores originais. */
  tint?: BossTint | null;
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
            {tint ? <ColorMatrix matrix={TINTS[tint]} /> : null}
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
