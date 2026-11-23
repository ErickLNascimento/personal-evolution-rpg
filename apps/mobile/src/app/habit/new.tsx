import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { StackScreen } from '@/components/Screen';
import { createHabit } from '@/features/habits/api';
import { EMPTY_DRAFT, HabitForm } from '@/features/habits/HabitForm';
import { useToday } from '@/features/profile/useToday';
import { colors } from '@/theme/tokens';

export default function NewHabitScreen() {
  const { today, ready } = useToday();

  if (!ready) {
    return (
      <StackScreen>
        <ActivityIndicator color={colors.primary} />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <HabitForm
        initial={EMPTY_DRAFT}
        submitLabel="Criar hábito"
        onSubmit={async (input) => {
          // Começa hoje, no fuso do perfil: entra nas missões de hoje se o dia estiver na agenda.
          const r = await createHabit(input, today);
          if (r.error !== null) return r.error;
          router.back();
          return null;
        }}
      />
    </StackScreen>
  );
}
