import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme/tokens';
import { useT } from '@/i18n';

/** Bloco cinza que pulsa no lugar do conteúdo enquanto carrega. */
export function Skeleton({
  width = '100%',
  height,
  style,
  round = false,
}: {
  width?: DimensionValue;
  height: number;
  style?: ViewStyle;
  round?: boolean;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.4 }));
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: round ? height / 2 : radius.md,
          backgroundColor: colors.surfaceRaised,
        },
        style,
        animated,
      ]}
    />
  );
}

/** Esqueleto da tela Hoje: card do herói, seletor Ontem | Hoje e três missões. */
export function TodaySkeleton() {
  const { t } = useT();
  return (
    <View style={styles.wrap} accessible accessibilityLabel={t('screens.loadingMissions')}>
      <View style={styles.card}>
        <Skeleton width={96} height={110} />
        <View style={styles.lines}>
          <Skeleton width="50%" height={12} />
          <Skeleton width="80%" height={20} />
          <Skeleton width="40%" height={12} />
        </View>
        <Skeleton width={64} height={64} round />
      </View>
      <Skeleton height={52} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={68} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  lines: { flex: 1, gap: spacing.sm },
});
