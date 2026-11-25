import { addDays, endVacationEffect, type LocalDate, type Vacation } from '@per/domain';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { endVacation } from '@/features/vacation/api';
import { useT } from '@/i18n';
import { syncReminders } from '@/lib/reminders';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatShortDate } from './formatDate';

/**
 * Tela Hoje num dia de férias: no lugar das missões, quando elas voltam. Com a flag ligada e o
 * dia sendo hoje, dá para voltar antes (as missões de hoje reaparecem).
 */
export function VacationNotice({
  vacation,
  date,
  today,
  canEnd,
  onChanged,
}: {
  vacation: Vacation;
  date: LocalDate;
  today: LocalDate;
  /** Flag ligada: mostra "Voltar agora". */
  canEnd: boolean;
  onChanged: () => void;
}) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const back = addDays(vacation.endDate, 1);

  function confirmEnd() {
    const effect = endVacationEffect(vacation, today);
    Alert.alert(
      t('vacation.endTitle'),
      effect.kind === 'delete' ? t('vacation.cancelText') : t('vacation.endText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vacation.endNow'),
          onPress: async () => {
            setBusy(true);
            setError(null);
            const r = await endVacation(vacation.id);
            setBusy(false);
            if (r.error !== null) return setError(r.error);
            void syncReminders().catch(() => undefined);
            onChanged();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.icon}>🏕</Text>
      <Text style={typography.heading} accessibilityRole="header">
        {date === today ? t('vacation.onVacation') : t('vacation.wasVacation')}
      </Text>
      <Text style={[typography.body, styles.center]}>
        {t('vacation.until', {
          end: formatShortDate(vacation.endDate, locale),
          back: formatShortDate(back, locale),
        })}
      </Text>
      <Text style={[typography.caption, styles.center]}>{t('vacation.streakSafe')}</Text>
      <FormMessage text={error} />
      {canEnd && date === today && (
        <Button title={t('vacation.endNow')} onPress={confirmEnd} variant="secondary" loading={busy} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: { fontSize: 40 },
  center: { textAlign: 'center' },
});
