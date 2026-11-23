import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_XP_TABLE, DIFFICULTY_LABEL, missionXp, type Mission, type XpTable } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const DIFFICULTY_COLOR = { easy: colors.accent, medium: colors.primary, hard: colors.danger } as const;

export function MissionCard({
  mission,
  onToggle,
  xpTable = DEFAULT_XP_TABLE,
  busy = false,
  awardedXp,
}: {
  mission: Mission;
  onToggle: () => void;
  xpTable?: XpTable;
  /** Salvando no banco: ignora toques até terminar. */
  busy?: boolean;
  /** XP ganho de fato no registro (se concluída); a dificuldade pode ter mudado depois. */
  awardedXp?: number;
}) {
  const { habit, done } = mission;
  const xp = missionXp({ done, difficulty: habit.difficulty }, awardedXp, xpTable);

  // Animações só quando a missão muda de estado depois de montada (não ao abrir a tela).
  const prevDone = useRef(done);
  const cardScale = useSharedValue(1);
  const checkScale = useSharedValue(1);
  const ring = useSharedValue(0);
  const floatXp = useSharedValue(0);

  useEffect(() => {
    if (prevDone.current === done) return;
    prevDone.current = done;
    if (done) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      cardScale.value = withSequence(withTiming(1.035, { duration: 110 }), withSpring(1, { damping: 8 }));
      checkScale.value = withSequence(withTiming(0.4, { duration: 0 }), withSpring(1, { damping: 6, stiffness: 220 }));
      ring.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
      floatXp.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }));
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  }, [done, cardScale, checkScale, ring, floatXp]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? 1 - ring.value : 0,
    transform: [{ scale: 0.6 + ring.value * 1.6 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({
    opacity: floatXp.value > 0 && floatXp.value < 1 ? 1 - floatXp.value * floatXp.value : 0,
    transform: [{ translateY: -floatXp.value * 34 }, { scale: 1 + floatXp.value * 0.25 }],
  }));

  return (
    <Animated.View style={cardStyle}>
      <Pressable
        onPress={onToggle}
        disabled={busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, busy }}
        accessibilityLabel={`${habit.title}, ${xp} XP`}
        accessibilityHint={done ? 'Toque para desfazer' : 'Toque para concluir'}
        style={({ pressed }) => [styles.card, done && styles.cardDone, (pressed || busy) && styles.pressed]}
      >
        <View style={[styles.stripe, { backgroundColor: DIFFICULTY_COLOR[habit.difficulty] }]} />
        <View style={styles.checkWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={checkStyle}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={30}
              color={done ? colors.accent : colors.textSecondary}
            />
          </Animated.View>
        </View>
        <View style={styles.body}>
          <Text style={[typography.body, done && styles.titleDone]}>{habit.title}</Text>
          <Text style={typography.caption}>{DIFFICULTY_LABEL[habit.difficulty]}</Text>
        </View>
        <View>
          <Text style={[styles.xp, done && styles.xpDone]}>+{xp} XP</Text>
          <Animated.Text style={[styles.floatXp, floatStyle]} pointerEvents="none">
            +{xp} XP
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'visible',
  },
  cardDone: { borderColor: colors.accent, backgroundColor: '#15241F' },
  pressed: { opacity: 0.8 },
  stripe: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, borderRadius: 2 },
  checkWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: colors.accent },
  body: { flex: 1, gap: 2 },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  xp: { fontWeight: '800', color: colors.xp },
  xpDone: { opacity: 0.6 },
  floatXp: { position: 'absolute', right: 0, top: 0, fontWeight: '900', fontSize: 16, color: colors.xp },
});
