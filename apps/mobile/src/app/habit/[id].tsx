import {
  describeSchedule,
  DIFFICULTY_LABELS,
  FEATURES,
  retireHabit,
  type HabitDraft,
  type LocalDate,
} from '@per/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import {
  getHabit,
  isLoggedOn,
  listHabitLogDates,
  retire,
  updateHabit,
  type HabitRecord,
} from '@/features/habits/api';
import { HabitForm } from '@/features/habits/HabitForm';
import { HabitStatsCard } from '@/features/habits/HabitStatsCard';
import { useFeature } from '@/features/profile/useFeature';
import { useToday } from '@/features/profile/useToday';
import { syncReminders } from '@/lib/reminders';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { currentLocale, useT } from '@/i18n';

function toDraft(h: HabitRecord): HabitDraft {
  return {
    title: h.title,
    kind: h.kind,
    difficulty: h.difficulty,
    scheduleDays: h.scheduleDays,
    objectiveId: h.objectiveId,
    targetQty: h.targetQty === null ? '' : String(h.targetQty).replace('.', ','),
    unit: h.unit ?? '',
    reminderTime: h.reminderTime,
    reminderEveryMinutes: h.reminderEveryMinutes,
    reminderUntil: h.reminderUntil ? h.reminderUntil.slice(0, 5) : null,
  };
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(currentLocale(), { timeZone: 'UTC' });
}

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { today, ready } = useToday();
  const { t, locale } = useT();
  const statsOn = useFeature(FEATURES.habitStats);
  const [habit, setHabit] = useState<HabitRecord | null>(null);
  const [logged, setLogged] = useState<Set<LocalDate> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retiring, setRetiring] = useState(false);

  useEffect(() => {
    let active = true;
    getHabit(id).then((r) => {
      if (!active) return;
      if (r.error !== null) setError(r.error);
      else setHabit(r.data);
    });
    // As estatísticas são extras: se falharem, a tela continua editável.
    listHabitLogDates(id).then((r) => {
      if (active && r.error === null) setLogged(r.data);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!habit) {
    return (
      <StackScreen>
        {error ? <FormMessage text={error} /> : <ActivityIndicator color={colors.primary} />}
      </StackScreen>
    );
  }

  const stats =
    logged && ready && statsOn ? (
      <HabitStatsCard habit={habit} logged={logged} today={today} />
    ) : null;

  if (habit.archivedOn) {
    return (
      <StackScreen>
        <View style={styles.card}>
          <Text style={typography.heading}>{habit.title}</Text>
          <Text style={typography.caption}>
            {DIFFICULTY_LABELS[locale][habit.difficulty]} ·{' '}
            {describeSchedule(habit.scheduleDays, locale)}
          </Text>
          <Text style={typography.body}>
            {t('habit.archivedInfo', {
              from: formatDate(habit.startDate),
              to: formatDate(habit.archivedOn),
            })}
          </Text>
        </View>
        {stats}
      </StackScreen>
    );
  }

  async function askRetire(current: HabitRecord) {
    setRetiring(true);
    const logged = await isLoggedOn(current.id, today);
    if (logged.error !== null) {
      setRetiring(false);
      setError(logged.error);
      return;
    }
    const action = retireHabit(current, today, logged.data);
    setRetiring(false);

    const [title, message, confirm] =
      action.kind === 'delete'
        ? [t('habit.deleteTitle'), t('habit.deleteText'), t('habit.delete')]
        : [
            t('habit.archiveTitle'),
            action.archivedOn === today ? t('habit.archiveToday') : t('habit.archiveNow'),
            t('habit.archive'),
          ];

    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: confirm,
        style: 'destructive',
        onPress: async () => {
          setRetiring(true);
          const r = await retire(current.id, action);
          setRetiring(false);
          if (r.error !== null) setError(r.error);
          else {
            void syncReminders();
            router.back();
          }
        },
      },
    ]);
  }

  return (
    <StackScreen>
      {stats}
      <HabitForm
        initial={toDraft(habit)}
        submitLabel={t('habitForm.save')}
        onSubmit={async (input) => {
          const r = await updateHabit(habit.id, input);
          if (r.error !== null) return r.error;
          void syncReminders();
          router.back();
          return null;
        }}
      />
      <View style={styles.divider} />
      <Text style={typography.caption}>{t('habit.editHint')}</Text>
      <FormMessage text={error} />
      <Button
        title={t('habit.archiveButton')}
        onPress={() => askRetire(habit)}
        variant="danger"
        loading={retiring}
        disabled={!ready}
      />
    </StackScreen>
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
  divider: { height: 1, backgroundColor: colors.border },
});
