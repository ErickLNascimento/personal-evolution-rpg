import { Ionicons } from '@expo/vector-icons';
import { describeSchedule, DIFFICULTY_LABEL, xpForHabit } from '@per/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { Placeholder, Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { listHabits, listObjectives, type HabitRecord, type ObjectiveRecord } from '@/features/habits/api';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

export default function HabitsScreen() {
  const { isDemo } = useAuth();
  if (isDemo) {
    return (
      <Screen title="Hábitos">
        <Placeholder text="Modo demonstração: configure o Supabase no .env.local para criar seus hábitos." />
      </Screen>
    );
  }
  return <HabitList />;
}

function HabitList() {
  const [habits, setHabits] = useState<HabitRecord[] | null>(null);
  const [objectives, setObjectives] = useState<ObjectiveRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Recarrega ao voltar da tela de criar/editar.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([listHabits(), listObjectives()]).then(([h, o]) => {
        if (!active) return;
        setError(h.error ?? o.error);
        if (h.data) setHabits(h.data);
        if (o.data) setObjectives(o.data);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const objectiveTitle = new Map(objectives.map((o) => [o.id, o.title]));
  const active = habits?.filter((h) => !h.archivedOn) ?? [];
  const archived = habits?.filter((h) => h.archivedOn) ?? [];

  return (
    <Screen title="Hábitos">
      <Button title="Novo hábito" onPress={() => router.push('/habit/new')} />
      <Button title="Sugestões da IA" onPress={() => router.push('/ai-plan')} variant="secondary" />
      <FormMessage text={error} />

      {habits === null && !error ? <ActivityIndicator color={colors.primary} /> : null}

      {habits !== null && active.length === 0 ? (
        <Placeholder text="Nenhum hábito ainda. Crie o primeiro: cada hábito vira uma missão nos dias da agenda e rende XP." />
      ) : null}

      {active.map((h) => (
        <HabitRow key={h.id} habit={h} objective={h.objectiveId ? objectiveTitle.get(h.objectiveId) : undefined} />
      ))}

      {archived.length > 0 && (
        <>
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showArchived }}
            style={styles.archivedToggle}
          >
            <Text style={typography.label}>ARQUIVADOS ({archived.length})</Text>
            <Ionicons name={showArchived ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </Pressable>
          {showArchived && archived.map((h) => <HabitRow key={h.id} habit={h} archived />)}
        </>
      )}
    </Screen>
  );
}

function HabitRow({ habit, objective, archived = false }: { habit: HabitRecord; objective?: string; archived?: boolean }) {
  const details = [DIFFICULTY_LABEL[habit.difficulty], describeSchedule(habit.scheduleDays)];
  if (habit.targetQty !== null) details.push(`${String(habit.targetQty).replace('.', ',')} ${habit.unit ?? ''}`.trim());

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}, ${details.join(', ')}${objective ? `, objetivo ${objective}` : ''}`}
      accessibilityHint={archived ? 'Ver detalhes' : 'Editar ou arquivar'}
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
