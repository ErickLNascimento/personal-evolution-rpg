import {
  addDays,
  dayStatuses,
  moodInsight,
  moodInsightText,
  moodStrip,
  MOOD_INSIGHT_MIN_DAYS,
  MOOD_LABEL,
  type Habit,
  type HabitLogEntry,
  type LocalDate,
  type MoodEntry,
} from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';
import { MoodFace } from './MoodFace';
import { useT } from '@/i18n';

const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Humor dos últimos 14 dias e a comparação com os dias de missões completas. */
export function MoodHistory({
  entries,
  habits,
  logs,
  today,
}: {
  entries: MoodEntry[];
  habits: readonly Habit[];
  logs: readonly HabitLogEntry[];
  today: LocalDate;
}) {
  const { t } = useT();
  const strip = moodStrip(entries, today, 14);
  const from = addDays(today, -59);
  const insight = moodInsight(
    entries.filter((e) => e.date >= from),
    dayStatuses(habits, logs, from, today),
  );
  const label = strip
    .filter((d) => d.mood !== null)
    .map((d) => `${d.date}: ${MOOD_LABEL[d.mood!]}`)
    .join(', ');

  return (
    <>
      <View style={styles.strip} accessible accessibilityLabel={label || t('mood.noneA11y')}>
        {strip.map((d) => (
          <View key={d.date} style={styles.day}>
            <MoodFace mood={d.mood} size={20} />
            <Text style={styles.weekday}>
              {WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={typography.caption}>
        {insight
          ? moodInsightText(insight)
          : entries.length === 0
            ? t('mood.emptyHint')
            : t('mood.keepGoing', { min: MOOD_INSIGHT_MIN_DAYS })}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  day: { alignItems: 'center', gap: 2, flex: 1 },
  weekday: { fontSize: 10, color: colors.textSecondary, marginTop: spacing.xs / 2 },
});
