import {
  habitHeatmap,
  habitStats,
  HEATMAP_WEEKS,
  RECENT_DAYS,
  type Habit,
  type HabitDayStatus,
  type LocalDate,
} from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

const CELL = 16;
const GAP = 4;

const CELL_STYLE: Record<HabitDayStatus, object> = {
  done: { backgroundColor: colors.accent },
  missed: { backgroundColor: colors.danger, opacity: 0.45 },
  open: { borderWidth: 1.5, borderColor: colors.accent },
  off: { backgroundColor: colors.surfaceRaised },
  outside: {},
};

const STATUS_KEY = {
  done: 'stats.statusDone',
  missed: 'stats.statusMissed',
  open: 'stats.statusOpen',
  off: 'stats.statusOff',
} as const;

function percent(rate: number | null) {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

interface Props {
  habit: Habit;
  logged: ReadonlySet<LocalDate>;
  today: LocalDate;
}

/** Taxa de conclusão, sequências e mapa de calor de um hábito. */
export function HabitStatsCard({ habit, logged, today }: Props) {
  const { t } = useT();
  const stats = habitStats(habit, logged, today);
  const weeks = habitHeatmap(habit, logged, today);
  const archived = Boolean(habit.archivedOn);

  const tiles = [
    { label: t('stats.recent', { days: RECENT_DAYS }), value: percent(stats.recentRate) },
    { label: t('stats.sinceStart'), value: percent(stats.rate) },
    ...(archived ? [] : [{ label: t('stats.current'), value: String(stats.currentStreak) }]),
    { label: t('stats.best'), value: String(stats.bestStreak) },
  ];

  return (
    <View style={styles.card}>
      <Text style={typography.label}>{t('stats.title')}</Text>

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View
            key={t.label}
            style={styles.tile}
            accessible
            accessibilityLabel={`${t.label}: ${t.value}`}
          >
            <Text style={styles.value}>{t.value}</Text>
            <Text style={typography.caption}>{t.label}</Text>
          </View>
        ))}
      </View>
      <Text style={typography.caption}>
        {stats.scheduled === 0
          ? t('stats.noData')
          : t(stats.scheduled === 1 ? 'stats.doneOne' : 'stats.doneMany', {
              done: stats.done,
              total: stats.scheduled,
            })}
      </Text>

      <View
        style={styles.heatmap}
        accessible
        accessibilityLabel={t('stats.heatmap', { weeks: HEATMAP_WEEKS, done: stats.done })}
      >
        <View style={styles.column}>
          {t('stats.weekdays')
            .split(',')
            .map((d, i) => (
              <Text key={i} style={styles.weekday}>
                {d}
              </Text>
            ))}
        </View>
        {weeks.map((w) => (
          <View key={w.start} style={styles.column}>
            {w.days.map((d) => (
              <View
                key={d.date}
                style={[styles.cell, CELL_STYLE[d.status], d.date === today && styles.today]}
                accessibilityLabel={d.status === 'outside' ? undefined : t(STATUS_KEY[d.status])}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        {(['done', 'missed', 'off'] as const).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.cell, CELL_STYLE[s]]} />
            <Text style={typography.caption}>{t(STATUS_KEY[s])}</Text>
          </View>
        ))}
      </View>
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  value: { fontSize: 22, fontWeight: '700', color: colors.text },
  heatmap: { flexDirection: 'row', gap: GAP, alignSelf: 'center', marginTop: spacing.sm },
  column: { gap: GAP },
  weekday: {
    width: CELL,
    height: CELL,
    fontSize: 10,
    lineHeight: CELL,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  today: { borderWidth: 1.5, borderColor: colors.text },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
