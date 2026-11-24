import { describeSchedule, DIFFICULTY_LABEL, retireHabit, type HabitDraft, type LocalDate } from '@per/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import { getHabit, isLoggedOn, listHabitLogDates, retire, updateHabit, type HabitRecord } from '@/features/habits/api';
import { HabitForm } from '@/features/habits/HabitForm';
import { HabitStatsCard } from '@/features/habits/HabitStatsCard';
import { useToday } from '@/features/profile/useToday';
import { syncReminders } from '@/lib/reminders';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function toDraft(h: HabitRecord): HabitDraft {
  return {
    title: h.title,
    difficulty: h.difficulty,
    scheduleDays: h.scheduleDays,
    objectiveId: h.objectiveId,
    targetQty: h.targetQty === null ? '' : String(h.targetQty).replace('.', ','),
    unit: h.unit ?? '',
    reminderTime: h.reminderTime,
  };
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { today, ready } = useToday();
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

  const stats = logged && ready ? <HabitStatsCard habit={habit} logged={logged} today={today} /> : null;

  if (habit.archivedOn) {
    return (
      <StackScreen>
        <View style={styles.card}>
          <Text style={typography.heading}>{habit.title}</Text>
          <Text style={typography.caption}>
            {DIFFICULTY_LABEL[habit.difficulty]} · {describeSchedule(habit.scheduleDays)}
          </Text>
          <Text style={typography.body}>
            Arquivado. Valeu de {formatDate(habit.startDate)} até {formatDate(habit.archivedOn)}; o XP ganho continua seu.
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
        ? ['Excluir hábito?', 'Ele ainda não tem nenhum registro, então será excluído.', 'Excluir']
        : [
            'Arquivar hábito?',
            action.archivedOn === today
              ? 'A missão de hoje já feita continua valendo. A partir de amanhã o hábito sai das suas missões.'
              : 'Ele sai das suas missões a partir de hoje. O histórico e o XP ganho continuam.',
            'Arquivar',
          ];

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
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
        submitLabel="Salvar alterações"
        onSubmit={async (input) => {
          const r = await updateHabit(habit.id, input);
          if (r.error !== null) return r.error;
          void syncReminders();
          router.back();
          return null;
        }}
      />
      <View style={styles.divider} />
      <Text style={typography.caption}>
        Mudanças de dificuldade valem para os próximos registros. Para tirar o hábito da rotina sem perder o histórico,
        arquive-o.
      </Text>
      <FormMessage text={error} />
      <Button title="Arquivar hábito" onPress={() => askRetire(habit)} variant="danger" loading={retiring} disabled={!ready} />
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
