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

const CELL = 16;
const GAP = 4;
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

const CELL_STYLE: Record<HabitDayStatus, object> = {
  done: { backgroundColor: colors.accent },
  missed: { backgroundColor: colors.danger, opacity: 0.45 },
  open: { borderWidth: 1.5, borderColor: colors.accent },
  off: { backgroundColor: colors.surfaceRaised },
  outside: {},
};

const STATUS_LABEL: Record<HabitDayStatus, string> = {
  done: 'feito',
  missed: 'perdido',
  open: 'em aberto',
  off: 'fora da agenda',
  outside: '',
};

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
  const stats = habitStats(habit, logged, today);
  const weeks = habitHeatmap(habit, logged, today);
  const archived = Boolean(habit.archivedOn);

  const tiles = [
    { label: `Últimos ${RECENT_DAYS} dias`, value: percent(stats.recentRate) },
    { label: 'Desde o início', value: percent(stats.rate) },
    ...(archived ? [] : [{ label: 'Sequência atual', value: String(stats.currentStreak) }]),
    { label: 'Melhor sequência', value: String(stats.bestStreak) },
  ];

  return (
    <View style={styles.card}>
      <Text style={typography.label}>ESTATÍSTICAS</Text>

      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={styles.tile} accessible accessibilityLabel={`${t.label}: ${t.value}`}>
            <Text style={styles.value}>{t.value}</Text>
            <Text style={typography.caption}>{t.label}</Text>
          </View>
        ))}
      </View>
      <Text style={typography.caption}>
        {stats.scheduled === 0
          ? 'Ainda sem dias para avaliar. Hoje e ontem só contam depois de feitos.'
          : `Feito ${stats.done} de ${stats.scheduled} ${stats.scheduled === 1 ? 'dia' : 'dias'} da agenda.`}
      </Text>

      <View
        style={styles.heatmap}
        accessible
        accessibilityLabel={`Mapa das últimas ${HEATMAP_WEEKS} semanas: ${stats.done} dias feitos`}
      >
        <View style={styles.column}>
          {WEEKDAYS.map((d, i) => (
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
                accessibilityLabel={STATUS_LABEL[d.status] || undefined}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        {(['done', 'missed', 'off'] as const).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.cell, CELL_STYLE[s]]} />
            <Text style={typography.caption}>{STATUS_LABEL[s]}</Text>
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
  weekday: { width: CELL, height: CELL, fontSize: 10, lineHeight: CELL, textAlign: 'center', color: colors.textSecondary },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  today: { borderWidth: 1.5, borderColor: colors.text },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
