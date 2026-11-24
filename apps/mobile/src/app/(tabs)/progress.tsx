import {
  addDays,
  dailyXp,
  displayedTitle,
  heroAttributes,
  isHeroUnset,
  OBJECTIVE_CATEGORIES,
  heroLook,
  NO_PATH,
  levelFromXp,
  startOfWeek,
  streakFrom,
  weekSummary,
  type WeekSummary,
} from '@per/domain';
import { router } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { Placeholder, Screen } from '@/components/Screen';
import { AttributeSheet } from '@/components/hero/AttributeSheet';
import { ObjectivesCard } from '@/components/ObjectivesCard';
import { HeroCard } from '@/components/hero/HeroCard';
import { Oracle } from '@/components/oracle/Oracle';
import { XpChart } from '@/components/XpChart';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { useToday } from '@/features/profile/useToday';
import { fetchProgress, type ProgressData, type WeeklyReview } from '@/features/progress/api';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Dias lidos para o streak. Sequências maiores aparecem como "90+". */
const STREAK_WINDOW = 90;
/** Dias no gráfico de XP; cobre também a semana passada inteira. */
const CHART_DAYS = 14;

export default function ProgressScreen() {
  const { isDemo } = useAuth();
  if (isDemo) {
    return (
      <Screen title="Progresso">
        <Placeholder text="Modo demonstração: configure o Supabase no .env.local para ver o seu progresso." />
      </Screen>
    );
  }
  return <RealProgress />;
}

function RealProgress() {
  const { today, ready } = useToday();
  const { profile } = useProfile();
  const load = useCallback(
    () => fetchProgress(addDays(today, -(STREAK_WINDOW - 1)), addDays(today, -(CHART_DAYS - 1))),
    [today],
  );
  const { data, error, refreshing, refresh } = useFocusLoad<ProgressData>(load, ready);

  if (!data) {
    return (
      <Screen title="Progresso" onRefresh={refresh} refreshing={refreshing}>
        {error ? (
          <>
            <FormMessage text={error} />
            <Button title="Tentar de novo" onPress={refresh} variant="secondary" />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  const level = levelFromXp(data.totalXp);
  const streak = streakFrom(data.habits, data.logs, today, STREAK_WINDOW);
  const chart = dailyXp(data.xp, addDays(today, -(CHART_DAYS - 1)), today);
  const thisWeek = weekSummary(data.habits, data.logs, data.xp, today, today);
  const lastWeekDate = addDays(startOfWeek(today), -1);
  const lastWeek = weekSummary(data.habits, data.logs, data.xp, lastWeekDate, lastWeekDate);

  return (
    <Screen title="Progresso" onRefresh={refresh} refreshing={refreshing}>
      <FormMessage text={error} />

      <HeroCard
        hero={heroLook(profile?.hero, level.level, profile?.heroPath ?? NO_PATH, profile?.race)}
        heroPath={profile?.heroPath}
        level={level}
        name={profile?.displayName ?? null}
        unset={isHeroUnset(profile?.hero)}
        onPress={() => router.push('/hero')}
        titleId={displayedTitle(
          profile?.equippedTitle,
          level.level,
          profile?.earnedTitles ?? new Set(),
        )}
      />

      <Card title="OBJETIVOS">
        <ObjectivesCard />
      </Card>

      <Card title="ATRIBUTOS">
        <AttributeSheet attributes={heroAttributes(data.attributeXp, OBJECTIVE_CATEGORIES)} />
      </Card>

      <Card title="STREAK">
        <View
          style={styles.hero}
          accessible
          accessibilityLabel={`Streak de ${streak.current} dias`}
        >
          <Text style={styles.heroNumber}>
            {streak.current}
            {streak.capped ? '+' : ''}
          </Text>
          <Text style={typography.body}>
            {streak.current === 1 ? 'dia completo seguido' : 'dias completos seguidos'}
          </Text>
        </View>
        <Text style={typography.caption}>
          Um dia conta quando todas as missões dele são feitas. Uma falta por semana é perdoada
          {streak.restDaysUsed > 0
            ? ` (${streak.restDaysUsed} ${streak.restDaysUsed === 1 ? 'usada' : 'usadas'} nesta sequência).`
            : '.'}{' '}
          Hoje só conta quando terminar.
        </Text>
      </Card>

      <Card title={`XP POR DIA · ÚLTIMOS ${CHART_DAYS} DIAS`}>
        <XpChart days={chart} />
      </Card>

      <Card title="REVISÃO SEMANAL">
        <WeekRow label="Esta semana (até hoje)" week={thisWeek} />
        <View style={styles.divider} />
        <WeekRow label="Semana passada" week={lastWeek} />
        <View style={styles.divider} />
        <AiReview review={data.review} />
      </Card>

      <Card title="ORÁCULO">
        <View style={styles.oracle}>
          <Oracle size={96} />
          <View style={styles.oracleText}>
            <Text style={typography.heading}>Peça conselho ao Oráculo</Text>
            <Text style={typography.caption}>
              Um plano de missões sob medida para um objetivo, ou uma revisão da sua semana.
            </Text>
          </View>
        </View>
        <Button title="✦ Consultar o Oráculo" onPress={() => router.push('/ai-plan')} />
      </Card>
    </Screen>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={typography.label} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function formatDay(date: string) {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

function WeekRow({ label, week }: { label: string; week: WeekSummary }) {
  const pct = Math.round(week.rate * 100);
  return (
    <View style={styles.week}>
      <View style={styles.weekHeader}>
        <Text style={typography.body}>{label}</Text>
        <Text style={typography.caption}>
          {formatDay(week.weekStart)} a {formatDay(week.weekEnd)}
        </Text>
      </View>
      {week.scheduled === 0 ? (
        <Text style={typography.caption}>Nenhuma missão agendada.</Text>
      ) : (
        <>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${label}: ${pct}% das missões`}
            accessibilityValue={{ min: 0, max: 100, now: pct }}
          >
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={typography.caption}>
            {week.completed} de {week.scheduled} missões ({pct}%) · {week.perfectDays}{' '}
            {week.perfectDays === 1 ? 'dia perfeito' : 'dias perfeitos'} · {week.xp} XP
          </Text>
        </>
      )}
    </View>
  );
}

const REVIEW_STATUS: Record<WeeklyReview['status'], string> = {
  proposed: 'aguardando sua decisão',
  accepted: 'aceita',
  rejected: 'recusada',
};

function AiReview({ review }: { review: WeeklyReview | null }) {
  if (!review) {
    return (
      <Text style={typography.caption}>
        O Oráculo ainda não revisou sua semana. Consulte-o quando quiser (é preciso permitir a IA no
        Perfil).
      </Text>
    );
  }
  const date = new Date(review.createdAt).toLocaleDateString('pt-BR');
  return (
    <View style={styles.week}>
      <Text style={typography.body}>Revisão do Oráculo de {date}</Text>
      {review.summary ? <Text style={typography.body}>{review.summary}</Text> : null}
      <Text style={typography.caption}>Status: {REVIEW_STATUS[review.status]}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  oracle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  oracleText: { flex: 1, gap: 2 },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
