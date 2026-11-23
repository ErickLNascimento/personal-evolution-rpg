import { RARITY_COLOR, RARITY_LABEL, titleInfo, titleName, type HeroForm, type TitleId } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  ZoomIn,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Cena de título desbloqueado: banner na cor da raridade, com brilho pulsando.
 * Secretos ganham o letreiro "TÍTULO SECRETO" (a surpresa é o ponto alto).
 */
export function TitleUnlockedOverlay({
  titleId,
  form,
  onEquip,
  onClose,
}: {
  titleId: TitleId;
  form: HeroForm;
  onEquip: () => void;
  onClose: () => void;
}) {
  const info = titleInfo(titleId);
  const color = RARITY_COLOR[info.rarity];
  const secret = info.kind === 'secret';

  const glow = useSharedValue(0);
  const shine = useSharedValue(-1);
  const nameScale = useSharedValue(0.6);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 450);
    glow.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    shine.value = withDelay(500, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }), -1));
    nameScale.value = withDelay(400, withSequence(withSpring(1.12, { damping: 6 }), withSpring(1, { damping: 10 })));
    return () => clearTimeout(t);
  }, [glow, shine, nameScale]);

  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.4 + glow.value * 0.6, opacity: 0.85 + glow.value * 0.15 }));
  const shineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shine.value * 260 }, { rotate: '20deg' }] }));
  const nameStyle = useAnimatedStyle(() => ({ transform: [{ scale: nameScale.value }] }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          entering={ZoomIn.springify().damping(11)}
          style={[styles.card, { borderColor: color, shadowColor: color }, glowStyle]}
        >
          <View style={styles.shineClip} pointerEvents="none">
            <Animated.View style={[styles.shine, shineStyle]} />
          </View>
          <Text style={[styles.kicker, { color }]}>
            {secret ? '✦ TÍTULO SECRETO DESBLOQUEADO ✦' : 'TÍTULO DESBLOQUEADO'}
          </Text>
          <Animated.Text style={[styles.name, { textShadowColor: color }, nameStyle]} accessibilityRole="header">
            {titleName(titleId, form)}
          </Animated.Text>
          <View style={[styles.rarity, { backgroundColor: `${color}26`, borderColor: color }]}>
            <Text style={[styles.rarityText, { color }]}>{RARITY_LABEL[info.rarity].toUpperCase()}</Text>
          </View>
          <Animated.Text entering={FadeInDown.delay(700)} style={styles.description}>
            {info.description}
          </Animated.Text>
          <Animated.View entering={FadeIn.delay(1000)} style={styles.buttons}>
            <Pressable
              onPress={onEquip}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { backgroundColor: color }, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>Exibir este título</Text>
            </Pressable>
            <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}>
              <Text style={styles.ghostText}>Continuar</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,8,14,0.9)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.surface,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  shineClip: { position: 'absolute', top: 0, bottom: 0, left: -120, right: -120, overflow: 'hidden' },
  shine: { position: 'absolute', top: -40, bottom: -40, width: 50, backgroundColor: 'rgba(255,255,255,0.07)' },
  kicker: { fontSize: 13, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  name: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  rarity: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  rarityText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  description: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  button: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '900', color: '#0B0B12' },
  ghost: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  pressed: { opacity: 0.85 },
});
