import {
  bossForWeek,
  bossText,
  DEFAULT_HERO,
  displayedTitle,
  isHeroUnset,
  heroLook,
  NO_PATH,
  shouldShowTour,
  stageName,
  startOfWeek,
  unseenReleaseItems,
  FEATURES,
  RELEASE_NOTES,
  type DayProgress,
  type LevelProgress,
  type Mission,
  type XpTable,
} from '@per/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Button, FormMessage } from '@/components/Form';
import { MissionCard } from '@/components/MissionCard';
import { Placeholder, Screen } from '@/components/Screen';
import { TodaySkeleton } from '@/components/Skeleton';
import { CompactHeroBar } from '@/components/today/CompactHeroBar';
import { HeroCheerPop } from '@/components/today/HeroCheerPop';
import { MoodCheckIn } from '@/components/mood/MoodCheckIn';
import { useFeature } from '@/features/profile/useFeature';
import { PromotionBanner } from '@/components/today/PromotionBanner';
import { BossBanner } from '@/components/challenges/BossCard';
import { AppTour } from '@/components/tour/AppTour';
import { markNewsSeen, newsSlides, seenNewsVersion } from '@/lib/whatsNew';
import { DayRing } from '@/components/today/DayRing';
import { DaySwitch } from '@/components/today/DaySwitch';
import { XpBar } from '@/components/XpBar';
import { PerfectDayBanner } from '@/components/celebration/PerfectDayBanner';
import { CrystalToast } from '@/components/crystals/Crystals';
import { HeroCard } from '@/components/hero/HeroCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchHeroPath, type HeroPathInfo } from '@/features/hero/pathApi';
import { useToday } from '@/features/profile/useToday';
import { autoProtectStreak } from '@/features/streak/api';
import { useProfile } from '@/features/profile/ProfileProvider';
import { useDay, type DayChoice } from '@/features/today/useDay';
import { useDemoDay } from '@/features/today/useDemoDay';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function TodayScreen() {
  const { isDemo } = useAuth();
  return isDemo ? <DemoToday /> : <RealToday />;
}

function DemoToday() {
  const { t } = useT();
  const { missions, progress, level, toggle, cheer } = useDemoDay();
  return (
    <Screen title={t('today.title')}>
      <View style={styles.banner}>
        <Text style={typography.caption}>{t('today.demo')}</Text>
      </View>
      <DayView
        top={
          <HeroCard
            hero={DEFAULT_HERO}
            heroPath={{ path: 'marcial', branch: null, stage: 0 }}
            level={level}
            name={null}
            unset={false}
            onPress={() => undefined}
            cheer={cheer}
          />
        }
        missions={missions}
        progress={progress}
        level={level}
        onToggle={toggle}
      />
    </Screen>
  );
}

function RealToday() {
  const { t, locale } = useT();
  const [choice, setChoice] = useState<DayChoice>('today');
  const day = useDay(choice);
  const { profile, update } = useProfile();
  // Tour no primeiro acesso: some na hora ao pular/terminar e fica salvo no perfil.
  const [tourClosed, setTourClosed] = useState(false);
  // Aparece para contas novas e antigas sempre que a equipe aumenta a versão do tour.
  const showTour =
    Boolean(profile) &&
    !tourClosed &&
    shouldShowTour(profile?.tourSeenVersion ?? 0, profile?.tourVersion ?? null);
  // Novidades da atualização: só para quem já conhece o app (o tour de quem é novo já cobre tudo).
  const [newsSeen, setNewsSeen] = useState(seenNewsVersion);
  const news = unseenReleaseItems(newsSeen, RELEASE_NOTES, profile?.features);
  const moodOn = useFeature(FEATURES.moodJournal);
  const shopOn = useFeature(FEATURES.shop);
  const challengesOn = useFeature(FEATURES.challenges);
  const showNews =
    Boolean(profile) && !showTour && news.length > 0 && (profile?.tourSeenVersion ?? 0) > 0;
  const hero = heroLook(
    profile?.hero,
    day.level.level,
    profile?.heroPath ?? NO_PATH,
    profile?.race,
    profile?.cosmetics,
  );
  const scrollY = useSharedValue(0);
  // Escudos de streak: usados sozinhos ao abrir o app, se algum dia fechado quebraria a sequência.
  const { today, ready: todayReady } = useToday();
  const [shieldSaved, setShieldSaved] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!todayReady) return;
      let alive = true;
      void autoProtectStreak(today).then((dates) => {
        if (alive && dates.length > 0) setShieldSaved(dates.length);
      });
      return () => {
        alive = false;
      };
    }, [today, todayReady]),
  );
  // Promoção disponível? (o banco confere nível e missões na área do caminho)
  const pathLoad = useCallback(() => fetchHeroPath(), []);
  const pathInfo = useFocusLoad<HeroPathInfo>(pathLoad);
  const heroPath = profile?.heroPath ?? NO_PATH;
  const ringLabel = choice === 'today' ? t('today.ringToday') : t('today.ringYesterday');
  const todayDate = day.days[day.days.length - 1]?.date;
  // O chefe só depende da semana; o placar fica na tela Desafios.
  const boss = bossForWeek(startOfWeek(todayDate ?? day.date));

  // O card do herói encolhe e esmaece ao rolar; a barra compacta assume o lugar dele.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 170], [1, 0.35], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, 170], [1, 0.94], Extrapolation.CLAMP) }],
  }));

  const ready = !day.loading && !day.failed;
  return (
    <>
      <AppTour
        visible={showTour}
        hero={hero}
        onClose={() => {
          setTourClosed(true);
          markNewsSeen();
          setNewsSeen(seenNewsVersion());
          void update({
            tour_seen_at: new Date().toISOString(),
            tour_seen_version: profile?.tourVersion ?? 0,
          });
        }}
      />
      {news.length > 0 && (
        <AppTour
          visible={showNews}
          hero={hero}
          slides={newsSlides(news, locale)}
          heading={t('today.news')}
          finishLabel={t('today.gotIt')}
          onClose={() => {
            markNewsSeen();
            setNewsSeen(seenNewsVersion());
          }}
        />
      )}
      <Screen
        title={t('today.title')}
        onRefresh={day.refresh}
        refreshing={day.refreshing}
        scrollY={scrollY}
        overlay={
          ready ? (
            <>
              <CompactHeroBar
                hero={hero}
                level={day.level}
                progress={day.progress}
                scrollY={scrollY}
                cheer={day.cheer}
              />
              <HeroCheerPop hero={hero} cheer={day.cheer} scrollY={scrollY} />
            </>
          ) : undefined
        }
      >
        {day.loading ? (
          <TodaySkeleton />
        ) : day.failed ? (
          <>
            <FormMessage text={day.error} />
            <Button title={t('common.retry')} onPress={day.refresh} variant="secondary" />
          </>
        ) : (
          <>
            <DaySwitch
              days={day.days}
              selected={day.date}
              onSelect={(d) => setChoice(d === todayDate ? 'today' : 'yesterday')}
            />
            {choice === 'yesterday' && (
              <Text style={typography.caption}>{t('today.yesterdayHint')}</Text>
            )}
            {profile && !heroPath.path ? (
              <PromotionBanner
                title={t('today.choosePath')}
                subtitle={t('today.choosePathHint')}
                onPress={() => router.push('/path')}
              />
            ) : pathInfo.data?.canPromote && heroPath.path && pathInfo.data.next ? (
              <PromotionBanner
                title={t('today.promotion')}
                subtitle={
                  pathInfo.data.needsBranch
                    ? t('today.promotionBranch')
                    : t('today.promotionTo', {
                        stage: stageName(
                          heroPath.path,
                          heroPath.branch,
                          pathInfo.data.next.tier,
                          hero.form,
                          locale,
                        ),
                      })
                }
                onPress={() => router.push('/promotion')}
              />
            ) : null}
            {shieldSaved > 0 && (
              <FormMessage
                tone="info"
                text={
                  shieldSaved === 1
                    ? t('today.shieldOne')
                    : t('today.shieldMany', { count: shieldSaved })
                }
              />
            )}
            <CrystalToast gain={day.crystalGain} />
            {day.notice ? <PerfectDayBanner text={day.notice} /> : null}
            <FormMessage text={day.error} />
            <DayView
              top={
                <Animated.View style={heroStyle}>
                  <HeroCard
                    hero={hero}
                    level={day.level}
                    name={profile?.displayName ?? null}
                    unset={isHeroUnset(profile?.hero)}
                    onPress={() => router.push('/hero')}
                    crystals={day.crystals}
                    onShop={shopOn ? () => router.push('/shop') : undefined}
                    heroPath={profile?.heroPath}
                    titleId={displayedTitle(
                      profile?.equippedTitle,
                      day.level.level,
                      profile?.earnedTitles ?? new Set(),
                    )}
                    cheer={day.cheer}
                    aside={<DayRing progress={day.progress} label={ringLabel} />}
                  />
                </Animated.View>
              }
              missions={day.missions}
              progress={day.progress}
              level={day.level}
              xpTable={day.xpTable}
              pending={day.pending}
              awardedXp={day.awardedXp}
              flashFor={day.flashFor}
              onToggle={day.toggle}
              countOf={day.countOf}
              onCount={day.changeCount}
              empty={
                day.hasHabits ? (
                  <Placeholder
                    text={
                      choice === 'today'
                        ? t('today.noMissionsToday')
                        : t('today.noMissionsYesterday')
                    }
                  />
                ) : (
                  <>
                    <Placeholder text={t('today.noHabits')} />
                    <Button
                      title={t('today.createHabit')}
                      onPress={() => router.push('/habit/new')}
                    />
                  </>
                )
              }
            />
            {moodOn && <MoodCheckIn date={day.date} isToday={choice === 'today'} />}
            {day.hasHabits && challengesOn && (
              <BossBanner
                id={boss.id}
                name={bossText(boss, locale).name}
                hits={day.cheer}
                onPress={() => router.push('/challenges')}
              />
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function DayView({
  missions,
  progress,
  level,
  xpTable,
  pending,
  awardedXp,
  flashFor,
  onToggle,
  countOf,
  onCount,
  empty,
  top,
}: {
  missions: Mission[];
  progress: DayProgress;
  level: LevelProgress;
  xpTable?: XpTable;
  pending?: ReadonlySet<string>;
  awardedXp?: (habitId: string) => number | undefined;
  flashFor?: (habitId: string) => { deadline: Date; awarded: boolean } | null;
  onToggle: (habitId: string) => void;
  /** Contagem do dia (hábitos contador). */
  countOf?: (habitId: string) => number;
  onCount?: (habitId: string, delta: number) => void;
  empty?: ReactNode;
  /** Cabeçalho no lugar da barra de XP simples (ex.: o cartão do herói). */
  top?: ReactNode;
}) {
  const { t } = useT();
  const bonus = xpTable?.perfectDayBonus ?? 20;
  return (
    <>
      {top ?? (
        <View style={styles.card}>
          <XpBar progress={level} />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={typography.label}>{t('today.missions')}</Text>
        <Text style={typography.caption}>
          {progress.done}/{progress.total}
          {progress.perfect && bonus > 0 ? `  ·  ${t('today.perfectBonus', { xp: bonus })}` : ''}
        </Text>
      </View>

      {missions.length === 0 && empty}

      {missions.map((m) => (
        <MissionCard
          key={m.habit.id}
          mission={m}
          xpTable={xpTable}
          busy={pending?.has(m.habit.id)}
          awardedXp={awardedXp?.(m.habit.id)}
          flash={flashFor?.(m.habit.id)}
          onToggle={() => onToggle(m.habit.id)}
          count={m.habit.kind === 'count' ? countOf?.(m.habit.id) : undefined}
          onCount={onCount ? (delta) => onCount(m.habit.id, delta) : undefined}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
