import type { DayProgress, HeroLook, LevelProgress } from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { colors, radius, spacing } from '@/theme/tokens';
import { DayRing } from './DayRing';

/**
 * Barra fina que aparece no topo quando o card do herói sai da tela ao rolar:
 * herói, nível, XP e o anel do dia continuam à vista enquanto se percorre a lista.
 * A animação roda na thread de UI (segue o dedo sem travar).
 */
export function CompactHeroBar({
  hero,
  level,
  progress,
  scrollY,
  showAfter = 150,
}: {
  hero: HeroLook;
  level: LevelProgress;
  progress: DayProgress;
  scrollY: SharedValue<number>;
  /** Rolagem (em dp) a partir da qual a barra entra. */
  showAfter?: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [showAfter, showAfter + 50], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (t - 1) * 12 }] };
  });
  const pct = Math.round(level.progress * 100);
  return (
    <Animated.View
      style={[styles.bar, style]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.avatar}>
        <HeroAvatar hero={hero} size={30} />
      </View>
      <View style={styles.info}>
        <Text style={styles.level}>Nível {level.level}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      <DayRing progress={progress} size={36} stroke={4} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 32,
    height: 40,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
  },
  info: { flex: 1, gap: 4 },
  level: { fontSize: 14, fontWeight: '700', color: colors.text },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.xp },
});
