import { displayedTitle, isHeroUnset, sanitizeHero, type DayProgress, type LevelProgress, type Mission, type XpTable } from '@per/domain';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, FormMessage } from '@/components/Form';
import { MissionCard } from '@/components/MissionCard';
import { Placeholder, Screen } from '@/components/Screen';
import { XpBar } from '@/components/XpBar';
import { PerfectDayBanner } from '@/components/celebration/PerfectDayBanner';
import { CrystalToast } from '@/components/crystals/Crystals';
import { HeroCard } from '@/components/hero/HeroCard';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { useDay, type DayChoice } from '@/features/today/useDay';
import { useDemoDay } from '@/features/today/useDemoDay';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const DAY_OPTIONS = [
  { value: 'today' as const, label: 'Hoje' },
  { value: 'yesterday' as const, label: 'Ontem' },
];

export default function TodayScreen() {
  const { isDemo } = useAuth();
  return isDemo ? <DemoToday /> : <RealToday />;
}

function DemoToday() {
  const { missions, progress, level, toggle } = useDemoDay();
  return (
    <Screen title="Hoje">
      <View style={styles.banner}>
        <Text style={typography.caption}>
          Modo demonstração: os dados ficam só na memória até o Supabase ser configurado no .env.local.
        </Text>
      </View>
      <DayView missions={missions} progress={progress} level={level} onToggle={toggle} />
    </Screen>
  );
}

function RealToday() {
  const [choice, setChoice] = useState<DayChoice>('today');
  const day = useDay(choice);
  const { profile } = useProfile();
  const hero = sanitizeHero(profile?.hero, day.level.level, profile?.owned);

  return (
    <Screen title="Hoje" onRefresh={day.refresh} refreshing={day.refreshing}>
      {day.loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : day.failed ? (
        <>
          <FormMessage text={day.error} />
          <Button title="Tentar de novo" onPress={day.refresh} variant="secondary" />
        </>
      ) : (
        <>
          <Chips options={DAY_OPTIONS} selected={[choice]} onToggle={setChoice} />
          {choice === 'yesterday' && (
            <Text style={typography.caption}>Esqueceu de marcar algo ontem? Dá para registrar até o fim de hoje.</Text>
          )}
          <CrystalToast gain={day.crystalGain} />
          {day.notice ? <PerfectDayBanner text={day.notice} /> : null}
          <FormMessage text={day.error} />
          <DayView
            top={
              <HeroCard
                hero={hero}
                level={day.level}
                name={profile?.displayName ?? null}
                unset={isHeroUnset(profile?.hero)}
                onPress={() => router.push('/hero')}
                crystals={day.crystals}
                titleId={displayedTitle(profile?.equippedTitle, day.level.level, profile?.earnedTitles ?? new Set())}
                onShop={() => router.push('/shop')}
              />
            }
            missions={day.missions}
            progress={day.progress}
            level={day.level}
            xpTable={day.xpTable}
            pending={day.pending}
            awardedXp={day.awardedXp}
            onToggle={day.toggle}
            empty={
              day.hasHabits ? (
                <Placeholder
                  text={choice === 'today' ? 'Nenhuma missão hoje. Aproveite o descanso!' : 'Nenhuma missão ontem.'}
                />
              ) : (
                <>
                  <Placeholder text="Você ainda não tem hábitos. Crie o primeiro e ele vira uma missão nos dias da agenda." />
                  <Button title="Criar hábito" onPress={() => router.push('/habit/new')} />
                </>
              )
            }
          />
        </>
      )}
    </Screen>
  );
}

function DayView({
  missions,
  progress,
  level,
  xpTable,
  pending,
  awardedXp,
  onToggle,
  empty,
  top,
}: {
  missions: Mission[];
  progress: DayProgress;
  level: LevelProgress;
  xpTable?: XpTable;
  pending?: ReadonlySet<string>;
  awardedXp?: (habitId: string) => number | undefined;
  onToggle: (habitId: string) => void;
  empty?: ReactNode;
  /** Cabeçalho no lugar da barra de XP simples (ex.: o cartão do herói). */
  top?: ReactNode;
}) {
  const bonus = xpTable?.perfectDayBonus ?? 20;
  return (
    <>
      {top ?? (
        <View style={styles.card}>
          <XpBar progress={level} />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={typography.label}>MISSÕES</Text>
        <Text style={typography.caption}>
          {progress.done}/{progress.total}
          {progress.perfect && bonus > 0 ? `  ·  Dia perfeito +${bonus} XP` : ''}
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
          onToggle={() => onToggle(m.habit.id)}
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
