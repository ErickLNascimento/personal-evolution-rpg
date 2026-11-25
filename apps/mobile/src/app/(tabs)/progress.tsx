import {
  addDays,
  dailyXp,
  displayedTitle,
  heroAttributes,
  OBJECTIVE_CATEGORIES,
  heroLook,
  recapWeekStart,
  shouldShowRecap,
  type WeeklyRecap,
  NO_PATH,
  levelFromXp,
  startOfWeek,
  streakFrom,
  weekSummary,
  type LocalDate,
  type MoodEntry,
  FEATURES,
  type WeekSummary,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { Placeholder, Screen } from '@/components/Screen';
import { AttributeSheet } from '@/components/hero/AttributeSheet';
import { ObjectivesCard } from '@/components/ObjectivesCard';
import { Chapter } from '@/components/profile/Chapter';
import { StatusPanel, type StatGem } from '@/components/progress/StatusPanel';
import { RECAP_TIER, WeeklyRecapBody } from '@/components/recap/WeeklyRecap';
import { fetchWeeklyRecap, markRecapSeen } from '@/features/recap/api';
import { MoodHistory } from '@/components/mood/MoodHistory';
import { Oracle } from '@/components/oracle/Oracle';
import { fetchMoodEntries } from '@/features/mood/api';
import { useFeature } from '@/features/profile/useFeature';
import { XpChart } from '@/components/XpChart';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { useToday } from '@/features/profile/useToday';
import { fetchProgress, type ProgressData, type WeeklyReview } from '@/features/progress/api';
import {
  autoProtectStreak,
  buyShield,
  fetchShields,
  type StreakShields,
} from '@/features/streak/api';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

const ORACLE = '#5CF2E0';

/** Dias lidos para o streak. Sequências maiores aparecem como "90+". */
const STREAK_WINDOW = 90;
/** Dias no gráfico de XP; cobre também a semana passada inteira. */
const CHART_DAYS = 14;

export default function ProgressScreen() {
  const { t } = useT();
  const { isDemo } = useAuth();
  if (isDemo) {
    return (
      <Screen title={t('progress.title')}>
        <Placeholder text={t('progress.demo')} />
      </Screen>
    );
  }
  return <RealProgress />;
}

function RealProgress() {
  const { t, locale } = useT();
  const { today, ready } = useToday();
  const { profile } = useProfile();
  const moodOn = useFeature(FEATURES.moodJournal);
  const shieldsOn = useFeature(FEATURES.streakShields);
  const oracleOn = useFeature(FEATURES.oracle);
  const load = useCallback(async () => {
    const p = await fetchProgress(
      addDays(today, -(STREAK_WINDOW - 1)),
      addDays(today, -(CHART_DAYS - 1)),
    );
    if (p.error !== null) return p;
    // Escudos guardados seguram sozinhos as faltas que quebrariam o streak.
    const protectedNow = await autoProtectStreak(today);
    const shields = shieldsOn ? await fetchShields() : { data: null };
    // O diário é extra: sem ele (ou sem a migration), o resto da tela segue.
    const mood = moodOn ? await fetchMoodEntries(addDays(today, -59)) : { data: [] };
    return {
      data: { ...p.data, shields: shields.data, protectedNow, mood: mood.data ?? [] },
      error: null,
    };
  }, [today, moodOn, shieldsOn]);
  const { data, error, refreshing, refresh } = useFocusLoad<
    ProgressData & { shields: StreakShields | null; protectedNow: LocalDate[]; mood: MoodEntry[] }
  >(load, ready);

  // Crônica da semana: de segunda a quarta, no topo; abrir a aba apaga o ponto dourado.
  const recapOn = useFeature(FEATURES.weeklyRecap);
  const recapTime = recapOn && ready && shouldShowRecap(today, null);
  const loadRecap = useCallback(() => fetchWeeklyRecap(today), [today]);
  const recap = useFocusLoad<WeeklyRecap | null>(loadRecap, recapTime);
  const userId = profile?.id;
  useFocusEffect(
    useCallback(() => {
      if (recapTime && userId) markRecapSeen(userId, recapWeekStart(today));
    }, [recapTime, userId, today]),
  );

  if (!data) {
    return (
      <Screen title={t('progress.title')} onRefresh={refresh} refreshing={refreshing}>
        {error ? (
          <>
            <FormMessage text={error} />
            <Button title={t('common.retry')} onPress={refresh} variant="secondary" />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  const level = levelFromXp(data.totalXp);
  const streak = streakFrom(data.habits, data.logs, today, STREAK_WINDOW, {
    openDays: 1,
    shielded: data.shields?.usedDates ?? new Set(),
  });
  const chart = dailyXp(data.xp, addDays(today, -(CHART_DAYS - 1)), today);
  const thisWeek = weekSummary(data.habits, data.logs, data.xp, today, today);
  const lastWeekDate = addDays(startOfWeek(today), -1);
  const lastWeek = weekSummary(data.habits, data.logs, data.xp, lastWeekDate, lastWeekDate);

  const attributes = heroAttributes(data.attributeXp, OBJECTIVE_CATEGORIES, locale);
  const topAttribute = [...attributes].sort((a, b) => b.xp - a.xp)[0];
  const chartXp = chart.reduce((sum, d) => sum + d.xp, 0);
  const hero = heroLook(
    profile?.hero,
    level.level,
    profile?.heroPath ?? NO_PATH,
    profile?.race,
    profile?.cosmetics,
  );
  const gems: StatGem[] = [
    {
      icon: 'flame',
      color: '#FB923C',
      value: `${streak.current}${streak.capped ? '+' : ''}`,
      label: t('progressMenu.streakGem'),
    },
    ...(data.shields
      ? [
          {
            icon: 'shield' as const,
            color: colors.accent,
            value: `${data.shields.held}/${data.shields.max}`,
            label: t('progressMenu.shieldsGem'),
          },
        ]
      : []),
    {
      icon: 'star',
      color: colors.xp,
      value: data.totalXp.toLocaleString(locale),
      label: t('progressMenu.xpGem'),
    },
  ];

  return (
    <Screen title={t('progress.title')} onRefresh={refresh} refreshing={refreshing}>
      <FormMessage text={error} />

      <StatusPanel
        hero={hero}
        heroPath={profile?.heroPath}
        level={level}
        name={profile?.displayName ?? null}
        titleId={displayedTitle(
          profile?.equippedTitle,
          level.level,
          profile?.earnedTitles ?? new Set(),
        )}
        gems={gems}
      />

      {recap.data && (
        <Chapter
          icon={RECAP_TIER[recap.data.tier].icon}
          color={RECAP_TIER[recap.data.tier].color}
          title={t('recap.title')}
          summary={`${t(RECAP_TIER[recap.data.tier].title)} · ${recap.data.week.completed}/${recap.data.week.scheduled}`}
          defaultOpen
        >
          <WeeklyRecapBody recap={recap.data} />
        </Chapter>
      )}

      <Chapter
        icon="barbell"
        color={colors.primary}
        title={t('progress.attributes')}
        summary={
          topAttribute && topAttribute.xp > 0
            ? t('progressMenu.attributesSummary', { label: topAttribute.label, level: topAttribute.level })
            : t('progressMenu.attributesEmpty')
        }
      >
        <AttributeSheet attributes={attributes} />
      </Chapter>

      <Chapter
        icon="flag"
        color={colors.accent}
        title={t('progress.objectives')}
        summary={t('progressMenu.objectivesSummary')}
      >
        <ObjectivesCard />
      </Chapter>

      <Chapter
        icon="flame"
        color="#FB923C"
        title={t('progressMenu.streak')}
        summary={t(streak.current === 1 ? 'progressMenu.streakSummaryOne' : 'progressMenu.streakSummary', {
          days: streak.current,
        })}
      >
        <View
          style={styles.hero}
          accessible
          accessibilityLabel={t('progress.streakA11y', { days: streak.current })}
        >
          <Text style={styles.heroNumber}>
            {streak.current}
            {streak.capped ? '+' : ''}
          </Text>
          <Text style={typography.body}>
            {streak.current === 1 ? t('progress.streakOne') : t('progress.streakMany')}
          </Text>
        </View>
        <Text style={typography.caption}>
          {t('progress.streakRule')}
          {streak.restDaysUsed > 0
            ? t(streak.restDaysUsed === 1 ? 'progress.restUsedOne' : 'progress.restUsedMany', {
                count: streak.restDaysUsed,
              })
            : '.'}{' '}
          {t('progress.openDays')}
        </Text>
        {data.shields && (
          <ShieldRow
            shields={data.shields}
            savedNow={data.protectedNow}
            savedInStreak={streak.shieldsUsed}
            onBought={refresh}
          />
        )}
      </Chapter>

      {moodOn && (
        <Chapter
          icon="happy"
          color="#F472B6"
          title={t('progress.mood')}
          summary={t('progressMenu.moodSummary')}
        >
          <MoodHistory entries={data.mood} habits={data.habits} logs={data.logs} today={today} />
        </Chapter>
      )}

      <Chapter
        icon="stats-chart"
        color="#3D7BFF"
        title={t('progress.xpPerDay', { days: CHART_DAYS })}
        summary={t('progressMenu.xpSummary', { xp: chartXp, days: CHART_DAYS })}
      >
        <XpChart days={chart} />
      </Chapter>

      <Chapter
        icon="calendar"
        color="#94A3B8"
        title={t('progress.weekly')}
        summary={
          thisWeek.scheduled > 0
            ? t('progressMenu.weekSummary', { done: thisWeek.completed, total: thisWeek.scheduled })
            : t('progress.noScheduled')
        }
      >
        <WeekRow label={t('progress.thisWeek')} week={thisWeek} />
        <View style={styles.divider} />
        <WeekRow label={t('progress.lastWeek')} week={lastWeek} />
        <View style={styles.divider} />
        <AiReview review={data.review} />
      </Chapter>

      {oracleOn && (
        <Pressable
          onPress={() => router.push('/ai-plan')}
          accessibilityRole="button"
          accessibilityLabel={`${t('progress.oracleTitle')}. ${t('progress.oracleText')}`}
          style={({ pressed }) => [styles.oracle, pressed && styles.pressed]}
        >
          <Oracle size={64} glow={false} />
          <View style={styles.oracleText}>
            <Text style={styles.oracleKicker}>{t('oracle.name').toUpperCase()}</Text>
            <Text style={typography.body}>{t('progress.oracleTitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={ORACLE} />
        </Pressable>
      )}
    </Screen>
  );
}

const dayFormat = (locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Escudos de streak: quantos tem, comprar mais e o aviso quando um escudo acabou de salvar o streak. */
function ShieldRow({
  shields,
  savedNow,
  savedInStreak,
  onBought,
}: {
  shields: StreakShields;
  savedNow: LocalDate[];
  savedInStreak: number;
  onBought: () => void;
}) {
  const { t, locale } = useT();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = shields.held >= shields.max;

  async function buy() {
    setBuying(true);
    setError(null);
    const r = await buyShield();
    setBuying(false);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onBought();
  }

  return (
    <View style={styles.shields}>
      {savedNow.length > 0 && (
        <FormMessage
          tone="info"
          text={t(savedNow.length === 1 ? 'shields.savedOne' : 'shields.savedMany', {
            count: savedNow.length,
            days: savedNow
              .map((d) => dayFormat(locale).format(new Date(`${d}T00:00:00Z`)))
              .join(', '),
          })}
        />
      )}
      <View style={styles.shieldHead}>
        <Text
          style={styles.shieldIcons}
          accessibilityLabel={t('shields.countA11y', { held: shields.held, max: shields.max })}
        >
          {'🛡'.repeat(shields.held)}
          <Text style={styles.shieldEmpty}>
            {'🛡'.repeat(Math.max(0, shields.max - shields.held))}
          </Text>
        </Text>
        <Text style={typography.caption}>
          {t('shields.count', { held: shields.held, max: shields.max })}
          {savedInStreak > 0
            ? t(savedInStreak > 1 ? 'shields.usedMany' : 'shields.usedOne', {
                count: savedInStreak,
              })
            : ''}
        </Text>
      </View>
      <Text style={typography.caption}>{t('shields.rule')}</Text>
      <FormMessage text={error} />
      <Button
        title={full ? t('shields.full') : t('shields.buy', { price: shields.price })}
        onPress={buy}
        loading={buying}
        disabled={full}
        variant="secondary"
      />
    </View>
  );
}

function formatDay(date: string) {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

function WeekRow({ label, week }: { label: string; week: WeekSummary }) {
  const { t } = useT();
  const pct = Math.round(week.rate * 100);
  return (
    <View style={styles.week}>
      <View style={styles.weekHeader}>
        <Text style={typography.body}>{label}</Text>
        <Text style={typography.caption}>
          {t('progress.weekRange', {
            from: formatDay(week.weekStart),
            to: formatDay(week.weekEnd),
          })}
        </Text>
      </View>
      {week.scheduled === 0 ? (
        <Text style={typography.caption}>{t('progress.noScheduled')}</Text>
      ) : (
        <>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('progress.weekA11y', { label, pct })}
            accessibilityValue={{ min: 0, max: 100, now: pct }}
          >
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={typography.caption}>
            {t('progress.weekSummary', {
              done: week.completed,
              total: week.scheduled,
              pct,
              perfect: week.perfectDays,
              perfectLabel:
                week.perfectDays === 1 ? t('progress.perfectOne') : t('progress.perfectMany'),
              xp: week.xp,
            })}
          </Text>
        </>
      )}
    </View>
  );
}

const REVIEW_STATUS = {
  proposed: 'progress.statusProposed',
  accepted: 'progress.statusAccepted',
  rejected: 'progress.statusRejected',
} as const satisfies Record<WeeklyReview['status'], string>;

function AiReview({ review }: { review: WeeklyReview | null }) {
  const { t, locale } = useT();
  if (!review) {
    return <Text style={typography.caption}>{t('progress.reviewNone')}</Text>;
  }
  const date = new Date(review.createdAt).toLocaleDateString(locale);
  return (
    <View style={styles.week}>
      <Text style={typography.body}>{t('progress.reviewOf', { date })}</Text>
      {review.summary ? <Text style={typography.body}>{review.summary}</Text> : null}
      <Text style={typography.caption}>
        {t('progress.reviewStatus', { status: t(REVIEW_STATUS[review.status]) })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shields: { gap: spacing.sm, marginTop: spacing.xs },
  shieldHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shieldIcons: { fontSize: 20 },
  shieldEmpty: { opacity: 0.25 },
  oracle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${ORACLE}55`,
    backgroundColor: colors.surface,
  },
  oracleText: { flex: 1, gap: 2 },
  oracleKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: ORACLE },
  pressed: { opacity: 0.8 },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  heroNumber: { fontSize: 44, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border },
  week: { gap: spacing.xs },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },
});
