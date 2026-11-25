import { FEATURES } from '@per/domain';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { StackScreen } from '@/components/Screen';
import { createHabit } from '@/features/habits/api';
import { EMPTY_DRAFT, HabitForm } from '@/features/habits/HabitForm';
import { useToday } from '@/features/profile/useToday';
import { useFeature } from '@/features/profile/useFeature';
import { syncReminders } from '@/lib/reminders';
import { colors } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function NewHabitScreen() {
  const { t } = useT();
  const oracleOn = useFeature(FEATURES.oracle);
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
        submitLabel={t('habitForm.create')}
        onConsultOracle={
          oracleOn
            ? (title) =>
                router.push({
                  pathname: '/ai-plan',
                  params: title.trim() ? { goal: title.trim() } : {},
                })
            : undefined
        }
        onSubmit={async (input) => {
          // Começa hoje, no fuso do perfil: entra nas missões de hoje se o dia estiver na agenda.
          const r = await createHabit(input, today);
          if (r.error !== null) return r.error;
          void syncReminders();
          router.back();
          return null;
        }}
      />
    </StackScreen>
  );
}
