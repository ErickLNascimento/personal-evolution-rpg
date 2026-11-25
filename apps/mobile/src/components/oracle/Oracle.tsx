import {
  Canvas,
  Circle,
  FilterMode,
  ImageShader,
  MipmapMode,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSkiaImage } from '@/components/sprites/useSkiaImage';
import { useT } from '@/i18n';

type SheetMeta = { frameWidth: number; frameHeight: number; frameCount: number; fps: number };

const SHEET = require('../../../assets/sprites/oracle/oracle_idle.png');
const META: SheetMeta = require('../../../assets/sprites/oracle/oracle_idle.json');

/**
 * O Oráculo (a IA do app) em pixel art: vidente encapuzado flutuando com uma esfera de cristal,
 * sobre um halo de luz que pulsa. Gerado por tools/sprites/gen_oracle.py.
 */
export function Oracle({ size = 128, glow = true }: { size?: number; glow?: boolean }) {
  const { t } = useT();
  const img = useSkiaImage(SHEET);
  const { frameCount, fps } = META;
  const time = useSharedValue(0);

  useFrameCallback((info) => {
    'worklet';
    time.set(info.timeSinceFirstFrame);
  });

  const x = useDerivedValue(() => -(Math.floor((time.get() * fps) / 1000) % frameCount) * size);
  // Halo respira em ~2,4 s (um pouco fora do ritmo do sprite, para não parecer mecânico).
  const glowR = useDerivedValue(
    () => size * (0.44 + 0.05 * Math.sin((time.get() / 2400) * 2 * Math.PI)),
  );
  const center = vec(size / 2, size * 0.62);

  return (
    <Canvas
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('oracle.a11y')}
    >
      {glow && (
        <Circle c={center} r={glowR}>
          <RadialGradient
            c={center}
            r={size * 0.5}
            colors={['#5CF2E0FF', '#5CF2E0BB', '#8B5CF677', '#8B5CF600']}
            positions={[0, 0.55, 0.8, 1]}
          />
        </Circle>
      )}
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
  );
}
