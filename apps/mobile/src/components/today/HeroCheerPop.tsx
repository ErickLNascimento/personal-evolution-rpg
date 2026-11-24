import type { HeroLook } from '@per/domain';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeOutDown,
  ZoomIn,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { colors, radius, spacing } from '@/theme/tokens';

/** Quanto tempo o balão fica na tela (a comemoração do herói cabe aqui). */
const SHOW_MS = 1700;

/**
 * Comemoração flutuante: quando uma missão é concluída com o card do herói fora da tela
 * (lista rolada), o herói aparece num balão perto da parte de baixo, comemora e some.
 * Com o card à vista, o balão fica invisível: a comemoração acontece no próprio card.
 * Não bloqueia toques.
 */
export function HeroCheerPop({
  hero,
  cheer,
  scrollY,
  showAfter = 150,
}: {
  hero: HeroLook;
  /** Sobe a cada missão concluída. */
  cheer: number;
  scrollY: SharedValue<number>;
  /** Rolagem (em dp) a partir da qual o card do herói já saiu da tela. */
  showAfter?: number;
}) {
  const [seen, setSeen] = useState(cheer);
  const [pop, setPop] = useState(0);
  if (cheer !== seen) {
    setSeen(cheer);
    if (cheer > seen) setPop((p) => p + 1);
  }

  useEffect(() => {
    if (pop === 0) return;
    const t = setTimeout(() => setPop(0), SHOW_MS);
    return () => clearTimeout(t);
  }, [pop]);

  // Decide na thread de UI se o card do herói está fora da tela.
  const visible = useAnimatedStyle(() => ({ opacity: scrollY.value > showAfter ? 1 : 0 }));

  if (pop === 0) return null;
  return (
    <Animated.View style={[styles.wrap, visible]} pointerEvents="none">
      <Animated.View
        key={pop}
        entering={ZoomIn.springify().damping(12)}
        exiting={FadeOutDown.duration(220)}
        style={styles.bubble}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.avatar}>
          <HeroAvatar hero={hero} size={64} entrance="celebrate" />
        </View>
        <Text style={styles.text}>Missão concluída!</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: spacing.lg, alignItems: 'center' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  avatar: {
    width: 68,
    height: 76,
    borderRadius: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  text: { fontSize: 16, fontWeight: '800', color: colors.accent },
});
