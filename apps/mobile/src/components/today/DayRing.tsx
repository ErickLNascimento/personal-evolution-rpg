import type { DayProgress } from '@per/domain';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anel de progresso do dia ("3/5"). Enche com animação a cada missão; dourado no dia perfeito. */
export function DayRing({
  progress,
  size = 64,
  stroke = 7,
  label = 'hoje',
}: {
  progress: DayProgress;
  size?: number;
  stroke?: number;
  /** Texto embaixo do número ("hoje", "ontem"). */
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const fill = useSharedValue(progress.ratio);

  useEffect(() => {
    fill.value = withTiming(progress.ratio, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [progress.ratio, fill]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));
  const color = progress.perfect ? colors.xp : colors.accent;
  const small = size < 48;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Missões de ${label}`}
      accessibilityValue={{
        min: 0,
        max: progress.total,
        now: progress.done,
        text: `${progress.done} de ${progress.total}`,
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text
          style={[
            styles.count,
            small && styles.countSmall,
            progress.perfect && { color: colors.xp },
          ]}
        >
          {progress.done}/{progress.total}
        </Text>
        {!small && <Text style={styles.label}>{label}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 16, fontWeight: '800', color: colors.text },
  countSmall: { fontSize: 10 },
  label: { fontSize: 10, color: colors.textSecondary, marginTop: -2 },
});
