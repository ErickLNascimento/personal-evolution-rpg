import {
  addDays,
  ambushGoalText,
  ambushPhase,
  ambushProgress,
  formatRemaining,
  OBJECTIVE_CATEGORY_LABELS,
  pick,
  type Ambush,
  type Habit,
  type LocalDate,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BOSS_COLOR } from '@/components/challenges/BossCard';
import { BossSprite, useBossAnim } from '@/components/challenges/BossSprite';
import { Button, FormMessage } from '@/components/Form';
import { claimAmbush } from '@/features/ambush/api';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const AMBUSH = '#FB923C';

/**
 * Tela Hoje durante uma emboscada: o minichefe, o desafio dos 2 dias, o progresso, o tempo que
 * falta e o resgate quando cumprido. Cada missão concluída dá o golpe nele.
 */
export function AmbushCard({
  ambush,
  habits,
  logged,
  today,
  hits,
  onClaimed,
}: {
  ambush: Ambush;
  habits: readonly Habit[];
  logged: ReadonlyMap<LocalDate, ReadonlySet<string>>;
  today: LocalDate;
  /** Sobe a cada missão concluída (o minichefe leva o golpe). */
  hits: number;
  onClaimed: (coins: number) => void;
}) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const phase = ambushPhase(ambush, today);
  const p = ambushProgress(ambush, habits, logged);
  const a = ambush.ambusher;
  const sprite = useBossAnim(
    { maxHp: p.target, hp: p.target - p.done, defeated: p.complete },
    { hits, tauntOnMount: false },
  );
  if (phase === 'upcoming' || (phase === 'ended' && (ambush.claimed || !p.complete))) return null;

  // Fim do desafio: meia-noite depois do último dia, na hora do aparelho.
  const deadline = new Date(`${addDays(ambush.endDate, 1)}T00:00:00`).getTime();
  const goal = ambushGoalText(a.goal, (c) => OBJECTIVE_CATEGORY_LABELS[locale][c], locale);
  const pct = (p.done / p.target) * 100;

  async function claim() {
    setBusy(true);
    setError(null);
    const r = await claimAmbush(ambush.startDate);
    setBusy(false);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClaimed(r.data.coins);
  }

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.stage, { borderColor: BOSS_COLOR[a.id] ?? AMBUSH }]}>
          <BossSprite id={a.id} size={64} {...sprite} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{t('ambush.kicker')}</Text>
          <Text style={typography.heading} numberOfLines={1}>
            {pick(a.name, locale)}
          </Text>
          <Text style={styles.taunt}>“{pick(a.taunt, locale)}”</Text>
        </View>
      </View>
      <Text style={typography.body}>
        {t('ambush.goal', { goal, reward: a.reward })}
      </Text>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('ambush.progressA11y', { done: p.done, target: p.target })}
        accessibilityValue={{ min: 0, max: p.target, now: p.done }}
      >
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={typography.caption}>
        {p.complete
          ? t('ambush.done')
          : t('ambush.progress', {
              done: p.done,
              target: p.target,
              left: formatRemaining(Math.max(0, deadline - now), locale),
            })}
      </Text>
      <FormMessage text={error} />
      {p.complete && !ambush.claimed && (
        <Button title={t('ambush.claim', { reward: a.reward })} onPress={claim} loading={busy} />
      )}
      {ambush.claimed && <Text style={styles.claimed}>{t('ambush.claimed', { reward: a.reward })}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: `${AMBUSH}88`,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stage: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  flex: { flex: 1, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: AMBUSH },
  taunt: { ...typography.caption, fontStyle: 'italic' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: AMBUSH },
  claimed: { ...typography.caption, color: colors.accent, fontWeight: '700' },
});
