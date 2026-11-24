import { Ionicons } from '@expo/vector-icons';
import {
  describeSchedule,
  DIFFICULTY_LABELS,
  FEATURES,
  formatReminderTime,
  parseReminderTime,
  xpForHabit,
} from '@per/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { OracleCallout } from '@/components/oracle/OracleCallout';
import { Placeholder, Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFeature } from '@/features/profile/useFeature';
import {
  listHabits,
  listObjectives,
  type HabitRecord,
  type ObjectiveRecord,
  type Result,
} from '@/features/habits/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function HabitsScreen() {
  const { t } = useT();
  const { isDemo } = useAuth();
  if (isDemo) {
    return (
      <Screen title={t('habits.title')}>
        <Placeholder text={t('common.demoHabits')} />
      </Screen>
    );
  }
  return <HabitList />;
}

async function loadHabitList(): Promise<
  Result<{ habits: HabitRecord[]; objectives: ObjectiveRecord[] }>
> {
  const [h, o] = await Promise.all([listHabits(), listObjectives()]);
  if (h.error !== null) return h;
  // Sem os objetivos, a lista ainda funciona (só não mostra o nome do objetivo).
  return { data: { habits: h.data, objectives: o.data ?? [] }, error: null };
}

function HabitList() {
  const { t } = useT();
  // Recarrega ao voltar da tela de criar/editar e ao puxar a tela.
  const { data, error, failed, refreshing, refresh } = useFocusLoad(loadHabitList);
  const [showArchived, setShowArchived] = useState(false);
  const habits = data?.habits ?? null;
  const objectives = data?.objectives ?? [];
  const oracleOn = useFeature(FEATURES.oracle);

  if (failed) {
    return (
      <Screen title={t('habits.title')} onRefresh={refresh} refreshing={refreshing}>
        <FormMessage text={error} />
        <Button title={t('common.retry')} onPress={refresh} variant="secondary" />
      </Screen>
    );
  }

  const objectiveTitle = new Map(objectives.map((o) => [o.id, o.title]));
  const active = habits?.filter((h) => !h.archivedOn) ?? [];
  const archived = habits?.filter((h) => h.archivedOn) ?? [];

  return (
    <Screen title={t('habits.title')} onRefresh={refresh} refreshing={refreshing}>
      <Button title={t('habits.newMission')} onPress={() => router.push('/habit/new')} />
      {habits !== null && oracleOn && (
        <OracleCallout
          says={active.length === 0 ? t('habits.oracleStart') : t('habits.oracleMore')}
          action={t('habits.consultOracle')}
          onPress={() => router.push('/ai-plan')}
        />
      )}
      <FormMessage text={error} />

      {habits === null && !error ? <ActivityIndicator color={colors.primary} /> : null}

      {habits !== null && active.length === 0 ? <Placeholder text={t('habits.empty')} /> : null}

      {active.map((h) => (
        <HabitRow
          key={h.id}
          habit={h}
          objective={h.objectiveId ? objectiveTitle.get(h.objectiveId) : undefined}
        />
      ))}

      {archived.length > 0 && (
        <>
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            style={styles.archivedToggle}
          >
            <Text style={typography.label}>{t('habits.archived', { count: archived.length })}</Text>
            <Ionicons
              name={showArchived ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
          {showArchived && archived.map((h) => <HabitRow key={h.id} habit={h} archived />)}
        </>
      )}
    </Screen>
  );
}

function HabitRow({
  habit,
  objective,
  archived = false,
}: {
  habit: HabitRecord;
  objective?: string;
  archived?: boolean;
}) {
  const { t, locale } = useT();
  const details = [
    DIFFICULTY_LABELS[locale][habit.difficulty],
    describeSchedule(habit.scheduleDays, locale),
  ];
  if (habit.kind !== 'do')
    details.unshift(habit.kind === 'avoid' ? t('habits.kindAvoid') : t('habits.kindCount'));
  if (habit.targetQty !== null)
    details.push(`${habit.targetQty.toLocaleString(locale)} ${habit.unit ?? ''}`.trim());
  const reminder = parseReminderTime(habit.reminderTime);
  if (reminder && !archived)
    details.push(t('habits.reminderAt', { time: formatReminderTime(reminder) }));

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}, ${details.join(', ')}${objective ? `, ${t('habits.objective', { name: objective })}` : ''}`}
      accessibilityHint={archived ? t('habits.hintArchived') : t('habits.hintActive')}
      style={({ pressed }) => [styles.row, archived && styles.archived, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text style={typography.body}>{habit.title}</Text>
        <Text style={typography.caption}>{details.join(' · ')}</Text>
        {objective ? <Text style={styles.objective}>◆ {objective}</Text> : null}
      </View>
      {!archived && <Text style={styles.xp}>+{xpForHabit(habit.difficulty)} XP</Text>}
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archived: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  objective: { ...typography.caption, color: colors.primary },
  xp: { fontWeight: '700', color: colors.xp },
  archivedToggle: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
