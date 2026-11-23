import { heroTitle, unlocksBetween, type HeroLook } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { tierColor } from '@/components/hero/HeroCard';
import { colors, radius, spacing } from '@/theme/tokens';

const RAYS = 16;
const PARTICLES = 18;

/** Raios de luz em leque, desenhados uma vez e girados pela animação. */
function Rays({ size, color }: { size: number; color: string }) {
  const c = size / 2;
  const paths = Array.from({ length: RAYS }, (_, i) => {
    const a = (i / RAYS) * Math.PI * 2;
    const w = Math.PI / RAYS / 1.6;
    const x1 = c + Math.cos(a - w) * c;
    const y1 = c + Math.sin(a - w) * c;
    const x2 = c + Math.cos(a + w) * c;
    const y2 = c + Math.sin(a + w) * c;
    return `M${c} ${c} L${x1} ${y1} L${x2} ${y2} Z`;
  });
  return (
    <Svg width={size} height={size}>
      {paths.map((d, i) => (
        <Path key={i} d={d} fill={color} opacity={i % 2 === 0 ? 0.28 : 0.14} />
      ))}
    </Svg>
  );
}

/** Uma faísca que sobe do chão e some, em loop. */
function Particle({ x, delay, color, height }: { x: number; delay: number; color: string; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 ? t.value * 10 : 1 - t.value,
    transform: [{ translateY: -t.value * height * 0.55 }, { scale: 1 - t.value * 0.6 }],
  }));
  return <Animated.View style={[styles.particle, { left: x, backgroundColor: color }, style]} />;
}

/**
 * Cena de subida de nível em tela cheia: escurece, clarão, raios girando,
 * herói surgindo com brilho, número do nível com impacto e lista de desbloqueios.
 */
export function LevelUpOverlay({
  visible,
  fromLevel,
  toLevel,
  hero,
  onClose,
}: {
  visible: boolean;
  fromLevel: number;
  toLevel: number;
  hero: HeroLook;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const color = tierColor(toLevel);
  const unlocks = useMemo(() => unlocksBetween(fromLevel, toLevel, hero.form), [fromLevel, toLevel, hero.form]);
  const newTitle = heroTitle(toLevel, hero.form) !== heroTitle(fromLevel, hero.form) ? heroTitle(toLevel, hero.form) : null;
  const raysSize = Math.hypot(width, height) * 1.1;
  const particles = useMemo(
    () => Array.from({ length: PARTICLES }, (_, i) => ({ x: (width / PARTICLES) * i + (i % 3) * 7, delay: (i * 137) % 1400 })),
    [width],
  );

  const backdrop = useSharedValue(0);
  const flash = useSharedValue(0);
  const spin = useSharedValue(0);
  const raysOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.3);
  const glow = useSharedValue(0);
  const headline = useSharedValue(0);
  const number = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    backdrop.value = 0;
    flash.value = 0;
    raysOpacity.value = 0;
    heroScale.value = 0.3;
    headline.value = 0;
    number.value = 0;
    shake.value = 0;

    backdrop.value = withTiming(1, { duration: 250 });
    flash.value = withDelay(250, withSequence(withTiming(0.85, { duration: 110 }), withTiming(0, { duration: 500 })));
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
    raysOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    heroScale.value = withDelay(350, withSpring(1, { damping: 9, stiffness: 120 }));
    glow.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    headline.value = withDelay(700, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) }));
    number.value = withDelay(950, withSpring(1, { damping: 7, stiffness: 160 }));
    shake.value = withDelay(
      1020,
      withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      ),
    );

    // Vibrações no ritmo da cena: chegada e impacto do número.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const impact = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 1000);
    const echo = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), 1150);
    return () => {
      clearTimeout(impact);
      clearTimeout(echo);
    };
  }, [visible, backdrop, flash, spin, raysOpacity, heroScale, glow, headline, number, shake]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const raysStyle = useAnimatedStyle(() => ({ opacity: raysOpacity.value, transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const heroStyle = useAnimatedStyle(() => ({ transform: [{ scale: heroScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.45, transform: [{ scale: 0.9 + glow.value * 0.2 }] }));
  const headlineStyle = useAnimatedStyle(() => ({ opacity: headline.value, transform: [{ translateY: (1 - headline.value) * 30 }] }));
  const numberStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, number.value * 2),
    transform: [{ scale: 3 - number.value * 2 }, { translateX: shake.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.fill, styles.backdrop, backdropStyle]}>
        <Animated.View style={[styles.rays, { width: raysSize, height: raysSize, left: (width - raysSize) / 2, top: height * 0.36 - raysSize / 2 }, raysStyle]}>
          <Rays size={raysSize} color={color} />
        </Animated.View>

        <View style={[styles.fill, styles.particles]} pointerEvents="none">
          {particles.map((p, i) => (
            <Particle key={i} x={p.x} delay={p.delay} color={i % 2 ? color : colors.xp} height={height} />
          ))}
        </View>

        <View style={styles.content}>
          <View style={styles.heroWrap}>
            <Animated.View style={[styles.glow, { backgroundColor: color, shadowColor: color }, glowStyle]} />
            <Animated.View style={heroStyle}>
              <HeroAvatar hero={hero} size={190} animated />
            </Animated.View>
          </View>

          <Animated.Text style={[styles.headline, headlineStyle]} accessibilityRole="header">
            SUBIU DE NÍVEL!
          </Animated.Text>
          <Animated.Text style={[styles.number, { color, textShadowColor: color }, numberStyle]} accessibilityLabel={`Nível ${toLevel}`}>
            {toLevel}
          </Animated.Text>

          {newTitle && (
            <Animated.Text entering={FadeInDown.delay(1350).duration(400)} style={styles.newTitle}>
              Novo título: <Text style={{ color }}>{newTitle}</Text>
            </Animated.Text>
          )}

          {unlocks.length > 0 && (
            <View style={styles.unlocks}>
              {unlocks
                .filter((u) => u.kind !== 'title')
                .slice(0, 5)
                .map((u, i) => (
                  <Animated.Text key={u.label} entering={FadeInDown.delay(1600 + i * 130).duration(350)} style={styles.unlock}>
                    ✦ Desbloqueado — {u.label}
                  </Animated.Text>
                ))}
            </View>
          )}

          <Animated.View entering={FadeIn.delay(1900).duration(400)} style={styles.buttonWrap}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { backgroundColor: color }, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.buttonText}>Continuar a jornada</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View pointerEvents="none" style={[styles.fill, styles.flash, flashStyle]} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: { backgroundColor: 'rgba(8,8,14,0.94)', overflow: 'hidden' },
  rays: { position: 'absolute' },
  particles: { overflow: 'hidden' },
  particle: { position: 'absolute', bottom: 40, width: 6, height: 6, borderRadius: 3 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  heroWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    shadowOpacity: 1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  headline: { fontSize: 22, fontWeight: '900', letterSpacing: 3, color: colors.text },
  number: {
    fontSize: 88,
    fontWeight: '900',
    lineHeight: 96,
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  newTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  unlocks: { gap: 4, marginTop: spacing.sm, alignItems: 'center' },
  unlock: { fontSize: 14, color: colors.textSecondary },
  buttonWrap: { marginTop: spacing.lg, alignSelf: 'stretch' },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 17, fontWeight: '800', color: '#0B0B12' },
  flash: { backgroundColor: '#FFFFFF' },
});
