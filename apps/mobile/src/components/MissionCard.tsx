import { Ionicons } from '@expo/vector-icons';
import {
  countLabel,
  DEFAULT_XP_TABLE,
  DIFFICULTY_LABELS,
  missionXp,
  type Mission,
  type XpTable,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { FLASH_COLOR, FlashBadge } from '@/components/today/FlashBadge';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

const DIFFICULTY_COLOR = {
  easy: colors.accent,
  medium: colors.primary,
  hard: colors.danger,
} as const;

export function MissionCard({
  mission,
  onToggle,
  xpTable = DEFAULT_XP_TABLE,
  busy = false,
  awardedXp,
  flash,
  count,
  onCount,
}: {
  mission: Mission;
  onToggle: () => void;
  xpTable?: XpTable;
  /** Salvando no banco: ignora toques até terminar. */
  busy?: boolean;
  /** XP ganho de fato no registro (se concluída); a dificuldade pode ter mudado depois. */
  awardedXp?: number;
  /** Se esta é a missão relâmpago do dia: prazo e se o bônus já foi concedido. */
  flash?: { deadline: Date; awarded: boolean } | null;
  /** Contagem do dia, se o hábito é um contador. */
  count?: number;
  /** Soma ao contador (+1 / −1). */
  onCount?: (delta: number) => void;
}) {
  const { habit, done } = mission;
  const { t, locale } = useT();
  const target = habit.targetQty ?? 0;
  const counter = habit.kind === 'count' && count !== undefined && target > 0 && onCount;
  const avoid = habit.kind === 'avoid';
  // Momento em que o card apareceu: a borda relâmpago some com o prazo vencido.
  const [openedAt] = useState(() => new Date());
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
      cardScale.value = withSequence(
        withTiming(1.035, { duration: 110 }),
        withSpring(1, { damping: 8 }),
      );
      checkScale.value = withSequence(
        withTiming(0.4, { duration: 0 }),
        withSpring(1, { damping: 6, stiffness: 220 }),
      );
      ring.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
      );
      floatXp.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) }),
      );
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
        onPress={counter ? () => onCount(1) : onToggle}
        disabled={busy}
        accessibilityRole={counter ? 'adjustable' : 'checkbox'}
        accessibilityState={counter ? { busy } : { checked: done, busy }}
        accessibilityLabel={`${habit.title}, ${xp} XP${counter ? `, ${countLabel(count, target, habit.unit, locale)}` : ''}`}
        accessibilityHint={
          counter
            ? t('mission.tapCount')
            : done
              ? t('mission.tapUndo')
              : avoid
                ? t('mission.tapResisted')
                : t('mission.tapComplete')
        }
        accessibilityActions={counter ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
        onAccessibilityAction={
          counter ? (e) => onCount(e.nativeEvent.actionName === 'increment' ? 1 : -1) : undefined
        }
        style={({ pressed }) => [
          styles.card,
          flash && !done && flash.deadline > openedAt && styles.cardFlash,
          done && styles.cardDone,
          (pressed || busy) && styles.pressed,
        ]}
      >
        <View style={[styles.stripe, { backgroundColor: DIFFICULTY_COLOR[habit.difficulty] }]} />
        <View style={styles.checkWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={checkStyle}>
            <Ionicons
              name={
                avoid
                  ? done
                    ? 'shield-checkmark'
                    : 'shield-outline'
                  : done
                    ? 'checkmark-circle'
                    : 'ellipse-outline'
              }
              size={30}
              color={done ? colors.accent : colors.textSecondary}
            />
          </Animated.View>
        </View>
        <View style={styles.body}>
          <Text style={[typography.body, done && styles.titleDone]}>{habit.title}</Text>
          <Text style={typography.caption}>
            {avoid ? (done ? t('mission.resisted') : t('mission.avoid')) : ''}
            {DIFFICULTY_LABELS[locale][habit.difficulty]}
          </Text>
          {counter ? (
            <View style={styles.countRow}>
              <Text style={[styles.countText, done && styles.countDone]}>
                {countLabel(count, target, habit.unit, locale)}
              </Text>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${Math.min(100, (count / target) * 100)}%` }]}
                />
              </View>
            </View>
          ) : null}
          {flash && (
            <FlashBadge
              deadline={flash.deadline}
              done={done}
              awarded={flash.awarded}
              missionXp={xp}
            />
          )}
        </View>
        <View style={styles.aside}>
          <Text style={[styles.xp, done && styles.xpDone]}>+{xp} XP</Text>
          <Animated.Text style={[styles.floatXp, floatStyle]} pointerEvents="none">
            +{xp} XP
          </Animated.Text>
          {counter ? (
            <View style={styles.stepper}>
              <StepButton
                icon="remove"
                label={t('mission.minusOne')}
                disabled={busy || count === 0}
                onPress={() => onCount(-1)}
              />
              <StepButton
                icon="add"
                label={t('mission.plusOne')}
                disabled={busy}
                onPress={() => onCount(1)}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.step,
        disabled && styles.stepDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
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
  cardFlash: { borderColor: FLASH_COLOR, borderWidth: 1.5 },
  pressed: { opacity: 0.8 },
  stripe: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, borderRadius: 2 },
  checkWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  body: { flex: 1, gap: 2 },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  xp: { fontWeight: '800', color: colors.xp },
  aside: { alignItems: 'flex-end', gap: spacing.sm },
  countRow: { gap: 4, marginTop: 2 },
  countText: { fontSize: 13, fontWeight: '700', color: colors.text },
  countDone: { color: colors.accent },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  stepper: { flexDirection: 'row', gap: spacing.xs },
  step: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDisabled: { opacity: 0.4 },
  xpDone: { opacity: 0.6 },
  floatXp: {
    position: 'absolute',
    right: 0,
    top: 0,
    fontWeight: '900',
    fontSize: 16,
    color: colors.xp,
  },
});
