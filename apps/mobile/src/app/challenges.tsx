import {
  addDays,
  canStartJourney,
  JOURNEY_LENGTHS,
  JOURNEY_PASS_PCT,
  JOURNEY_REWARD,
  journeyProgress,
  startOfWeek,
  weeklyBoss,
  BOSS_WEAKNESS,
  MONTHLY_REWARD,
  monthlyBoss,
  monthlyClaimOpen,
  monthStart,
  previousMonthStart,
  bossForWeek,
  type JourneyLength,
  type LocalDate,
  FEATURES,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { BossCard, BossDefeatedRow } from '@/components/challenges/BossCard';
import { Chips } from '@/components/Chips';
import { CrystalBadge } from '@/components/crystals/Crystals';
import { Button, FormMessage } from '@/components/Form';
import { FeatureGate } from '@/components/FeatureGate';
import { StackScreen } from '@/components/Screen';
import {
  abandonJourney,
  claimBoss,
  claimMonthlyBoss,
  fetchChallenges,
  resolveJourney,
  startJourney,
  type ChallengesData,
  type JourneyRecord,
} from '@/features/challenges/api';
import type { HabitRecord } from '@/features/habits/api';
import { useToday } from '@/features/profile/useToday';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';
import { useCelebration } from '@/features/celebration/CelebrationProvider';
import { rankFor, useBossProgress } from '@/features/bosses/api';
import { useFeature } from '@/features/profile/useFeature';
import { useProfile } from '@/features/profile/useProfile';

interface ScreenData extends ChallengesData {
  /** Jornadas que acabaram de ser decididas nesta visita. */
  results: { title: string; status: string; coins: number }[];
}

const STATUS_KEY = {
  won: 'challenges.won',
  lost: 'challenges.lost',
  abandoned: 'challenges.abandoned',
  active: 'challenges.won',
} as const;

function logsOf(data: ChallengesData, habitId: string): Set<LocalDate> {
  const set = new Set<LocalDate>();
  for (const [date, ids] of data.logged) if (ids.has(habitId)) set.add(date);
  return set;
}

/** Desafios com prazo: o chefe da semana e as jornadas de 21 ou 66 dias. */
function ChallengesScreen() {
  const { askFeedback } = useCelebration();
  const { t } = useT();
  const { today, ready } = useToday();
  const ranks = useBossProgress();
  const weaknessOn = useFeature(FEATURES.bossWeakness);
  const monthlyOn = useFeature(FEATURES.monthlyBoss);
  const { profile } = useProfile();

  // Carrega e já fecha no banco as jornadas com resultado decidido (o banco confere e paga).
  const load = useCallback(async () => {
    const first = await fetchChallenges(today);
    if (first.error !== null) return first;
    const decided = first.data.journeys.filter((j) => {
      const habit = first.data.habits.find((h) => h.id === j.habitId);
      return (
        j.status === 'active' &&
        habit &&
        journeyProgress(habit, logsOf(first.data, habit.id), j, today).outcome
      );
    });
    if (decided.length === 0) return { data: { ...first.data, results: [] }, error: null };

    const resolved = await Promise.all(decided.map((j) => resolveJourney(j.id)));
    const results = decided.flatMap((j, i) => {
      const r = resolved[i]!;
      if (r.error !== null || r.data.status === 'active') return [];
      const title =
        first.data.habits.find((h) => h.id === j.habitId)?.title ?? t('challenges.habit');
      return [{ title, status: r.data.status, coins: r.data.coins }];
    });
    const again = await fetchChallenges(today);
    if (again.error !== null) return again;
    return { data: { ...again.data, results }, error: null };
  }, [today, t]);
  const screen = useFocusLoad<ScreenData>(load, ready);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!screen.data) {
    return (
      <StackScreen>
        {screen.error ? (
          <FormMessage text={screen.error} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }
  const data = screen.data;
  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);
  // Patente de cada chefe para a pessoa: vida e prêmio maiores a cada vitória anterior.
  const now = rankFor(ranks.progress, thisWeek, ranks.enabled);
  const before = rankFor(ranks.progress, lastWeek, ranks.enabled);
  // Fraqueza: missões da área do chefe tiram 2 de vida (mesma conta do banco).
  const weakOf = (week: LocalDate) =>
    weaknessOn ? (BOSS_WEAKNESS[bossForWeek(week).id] ?? null) : null;
  const boss = weeklyBoss(data.habits, data.logged, today, thisWeek, now.rule.hpPct, weakOf(thisWeek));
  const previous = weeklyBoss(
    data.habits,
    data.logged,
    today,
    lastWeek,
    before.rule.hpPct,
    weakOf(lastWeek),
  );
  const shownRank = (r: typeof now) => (ranks.enabled ? r.rank : undefined);
  // Lorde do mês: o deste mês e, até o dia 7, o do mês anterior se caiu e falta resgatar.
  const thisMonth = monthStart(today);
  const lastMonth = previousMonthStart(thisMonth);
  const lordNow = monthlyBoss(data.habits, data.logged, thisMonth);
  const lordBefore = monthlyBoss(data.habits, data.logged, lastMonth);
  const lordReward = profile?.settings.get('monthly_boss_reward') ?? MONTHLY_REWARD;
  const asWeekly = (m: typeof lordNow) => ({ ...m, weekStart: m.monthStart, weekEnd: m.monthEnd });
  const active = data.journeys.filter((j) => j.status === 'active');
  const finished = data.journeys.filter((j) => j.status !== 'active').slice(0, 5);
  const habitById = new Map(data.habits.map((h) => [h.id, h]));

  async function claimLord(month: LocalDate) {
    setBusy(`lord:${month}`);
    setError(null);
    const r = await claimMonthlyBoss(month);
    setBusy(null);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotice(t('challenges.lordDefeated', { coins: r.data.coins }));
    screen.refresh();
    askFeedback('boss_defeated');
  }

  async function claim(week: LocalDate) {
    setBusy(`boss:${week}`);
    setError(null);
    const r = await claimBoss(week);
    setBusy(null);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotice(t('challenges.bossDefeated', { coins: r.data.coins }));
    screen.refresh();
    ranks.refresh();
    askFeedback('boss_defeated');
  }

  return (
    <StackScreen>
      <View style={styles.balance}>
        <CrystalBadge amount={data.crystals} />
      </View>
      {data.results.map((r) => (
        <FormMessage
          key={r.title + r.status}
          tone="info"
          text={
            r.status === 'won'
              ? t('challenges.journeyWon', { title: r.title, coins: r.coins })
              : t('challenges.journeyLost', { title: r.title })
          }
        />
      ))}
      {notice ? <FormMessage tone="info" text={notice} /> : null}
      <FormMessage text={error} />

      {previous.defeated &&
        (data.bossClaimed.has(lastWeek) ? (
          <BossDefeatedRow
            label={t('challenges.lastWeekBoss')}
            state={previous}
            rank={shownRank(before)}
          />
        ) : (
          <BossCard
            label={t('challenges.lastWeekBoss')}
            state={previous}
            rank={shownRank(before)}
            reward={before.rule.reward}
            claimed={false}
            busy={busy === `boss:${lastWeek}`}
            onClaim={() => claim(lastWeek)}
          />
        ))}
      <BossCard
        state={boss}
        rank={shownRank(now)}
        reward={now.rule.reward}
        claimed={data.bossClaimed.has(thisWeek)}
        busy={busy === `boss:${thisWeek}`}
        onClaim={() => claim(thisWeek)}
      />

      {monthlyOn &&
        lordBefore.defeated &&
        !data.monthlyClaimed.has(lastMonth) &&
        monthlyClaimOpen(lastMonth, today) && (
          <BossCard
            label={t('challenges.lastMonthLord')}
            state={asWeekly(lordBefore)}
            legendary
            reward={lordReward}
            claimed={false}
            busy={busy === `lord:${lastMonth}`}
            onClaim={() => claimLord(lastMonth)}
          />
        )}
      {monthlyOn && (
        <BossCard
          label={t('challenges.monthLord')}
          state={asWeekly(lordNow)}
          legendary
          reward={lordReward}
          claimed={data.monthlyClaimed.has(thisMonth)}
          busy={busy === `lord:${thisMonth}`}
          onClaim={() => claimLord(thisMonth)}
        />
      )}

      <Text style={typography.label}>{t('challenges.journeys')}</Text>
      <Text style={typography.caption}>
        {t('challenges.journeysHint', { pct: JOURNEY_PASS_PCT })}
      </Text>
      {active.map((j) => {
        const habit = habitById.get(j.habitId);
        return habit ? (
          <JourneyCard
            key={j.id}
            journey={j}
            habit={habit}
            logged={logsOf(data, habit.id)}
            today={today}
            busy={busy === j.id}
            onAbandon={() =>
              Alert.alert(t('challenges.endTitle'), t('challenges.endText'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('challenges.end'),
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(j.id);
                    const r = await abandonJourney(j.id);
                    setBusy(null);
                    if (r.error !== null) setError(r.error);
                    else screen.refresh();
                  },
                },
              ])
            }
          />
        ) : null;
      })}

      <NewJourney
        habits={data.habits.filter((h) => !h.archivedOn)}
        journeys={data.journeys}
        onStart={async (habitId, length) => {
          setError(null);
          const r = await startJourney(habitId, length);
          if (r.error !== null) return r.error;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          screen.refresh();
          return null;
        }}
      />

      {finished.length > 0 && (
        <>
          <Text style={typography.label}>{t('challenges.history')}</Text>
          {finished.map((j) => (
            <View key={j.id} style={styles.historyRow}>
              <Text style={[typography.body, styles.flex]}>
                {t('challenges.historyRow', {
                  title: habitById.get(j.habitId)?.title ?? t('challenges.habit'),
                  days: j.lengthDays,
                })}
              </Text>
              <Text style={[typography.caption, j.status === 'won' && styles.won]}>
                {t(STATUS_KEY[j.status])}
              </Text>
            </View>
          ))}
        </>
      )}
    </StackScreen>
  );
}

function JourneyCard({
  journey,
  habit,
  logged,
  today,
  busy,
  onAbandon,
}: {
  journey: JourneyRecord;
  habit: HabitRecord;
  logged: Set<LocalDate>;
  today: LocalDate;
  busy: boolean;
  onAbandon: () => void;
}) {
  const { t } = useT();
  const p = journeyProgress(habit, logged, journey, today);
  const pct = p.required === 0 ? 0 : Math.min(100, (p.done / p.required) * 100);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={[typography.heading, styles.flex]}>{habit.title}</Text>
        <Text style={styles.day}>
          {t('challenges.day', { day: p.day, total: journey.lengthDays })}
        </Text>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityLabel={t('challenges.doneA11y', { done: p.done, required: p.required })}
      >
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={typography.caption}>
        {t('challenges.progress', { done: p.done, required: p.required })}
        {p.missesLeft === 0
          ? t('challenges.noMissesLeft')
          : t(p.missesLeft === 1 ? 'challenges.missesLeftOne' : 'challenges.missesLeftMany', {
              count: p.missesLeft,
            })}
      </Text>
      <Text style={typography.caption}>
        {t('challenges.reward', { coins: JOURNEY_REWARD[journey.lengthDays] })}
      </Text>
      <Button
        title={t('challenges.endButton')}
        variant="secondary"
        onPress={onAbandon}
        loading={busy}
      />
    </View>
  );
}

function NewJourney({
  habits,
  journeys,
  onStart,
}: {
  habits: HabitRecord[];
  journeys: JourneyRecord[];
  onStart: (habitId: string, length: JourneyLength) => Promise<string | null>;
}) {
  const { t, locale } = useT();
  const free = habits.filter(
    (h) => !journeys.some((j) => j.status === 'active' && j.habitId === h.id),
  );
  const [habitId, setHabitId] = useState<string | null>(null);
  const [length, setLength] = useState<JourneyLength>(21);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (habits.length === 0)
    return <Text style={typography.caption}>{t('challenges.needHabit')}</Text>;

  const chosen = habitId && free.some((h) => h.id === habitId) ? habitId : null;
  const blocked = chosen
    ? canStartJourney(chosen, journeys, locale)
    : canStartJourney('', journeys, locale);

  return (
    <View style={styles.card}>
      <Text style={typography.label}>{t('challenges.newJourney')}</Text>
      {free.length === 0 ? (
        <Text style={typography.caption}>{t('challenges.allBusy')}</Text>
      ) : (
        <>
          <Chips
            options={free.map((h) => ({ value: h.id, label: h.title }))}
            selected={chosen ? [chosen] : []}
            onToggle={setHabitId}
          />
          <Chips
            options={JOURNEY_LENGTHS.map((n) => ({
              value: n,
              label: t('challenges.lengthOption', { days: n, coins: JOURNEY_REWARD[n] }),
              accessibilityLabel: t('challenges.lengthA11y', { days: n, coins: JOURNEY_REWARD[n] }),
            }))}
            selected={[length]}
            onToggle={setLength}
          />
          <Text style={typography.caption}>
            {length === 66 ? t('challenges.hint66') : t('challenges.hint21')}
          </Text>
          <FormMessage text={error ?? (chosen ? blocked : null)} />
          <Button
            title={t('challenges.start')}
            loading={saving}
            disabled={!chosen || Boolean(blocked)}
            onPress={async () => {
              if (!chosen) return;
              setSaving(true);
              const e = await onStart(chosen, length);
              setSaving(false);
              setError(e);
              if (!e) setHabitId(null);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { alignItems: 'flex-end' },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  day: { fontWeight: '700', color: colors.primary },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  won: { color: colors.accent, fontWeight: '700' },
});

export default function ChallengesScreenRoute() {
  return (
    <FeatureGate feature={FEATURES.challenges}>
      <ChallengesScreen />
    </FeatureGate>
  );
}
