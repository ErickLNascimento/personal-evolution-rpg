import {
  addDays,
  dailyXp,
  levelFromXp,
  startOfWeek,
  streakFrom,
  weekSummary,
  type WeekSummary,
} from '@per/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FormMessage } from '@/components/Form';
import { Placeholder, Screen } from '@/components/Screen';
import { XpBar } from '@/components/XpBar';
import { XpChart } from '@/components/XpChart';
import { useAuth } from '@/features/auth/AuthProvider';
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
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let active = true;
      fetchProgress(addDays(today, -(STREAK_WINDOW - 1)), addDays(today, -(CHART_DAYS - 1))).then((r) => {
        if (!active) return;
        setError(r.error);
        if (r.data) setData(r.data);
      });
      return () => {
        active = false;
      };
    }, [ready, today]),
  );

  if (!data) {
    return (
      <Screen title="Progresso">
        {error ? <FormMessage text={error} /> : <ActivityIndicator color={colors.primary} />}
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
    <Screen title="Progresso">
      <FormMessage text={error} />

      <Card title="NÍVEL">
        <XpBar progress={level} />
      </Card>

      <Card title="STREAK">
        <View style={styles.hero} accessible accessibilityLabel={`Streak de ${streak.current} dias`}>
          <Text style={styles.heroNumber}>
            {streak.current}
            {streak.capped ? '+' : ''}
          </Text>
          <Text style={typography.body}>{streak.current === 1 ? 'dia completo seguido' : 'dias completos seguidos'}</Text>
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
        Ainda não há revisão da IA. Quando ela estiver ativa (com sua permissão no Perfil), a última revisão aparece aqui.
      </Text>
    );
  }
  const date = new Date(review.createdAt).toLocaleDateString('pt-BR');
  return (
    <View style={styles.week}>
      <Text style={typography.body}>Revisão da IA de {date}</Text>
      {review.summary ? <Text style={typography.body}>{review.summary}</Text> : null}
      <Text style={typography.caption}>Status: {REVIEW_STATUS[review.status]}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },
});
