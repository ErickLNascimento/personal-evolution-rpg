import {
  addDays,
  currentOrNextVacation,
  endVacationEffect,
  validateVacation,
  vacationDaysInYear,
  vacationLength,
  VACATION_DAYS_PER_YEAR,
  type Vacation,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, FormMessage } from '@/components/Form';
import { useToday } from '@/features/profile/useToday';
import { endVacation, listVacations, startVacation } from '@/features/vacation/api';
import { useT } from '@/i18n';
import { syncReminders } from '@/lib/reminders';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { formatShortDate } from './formatDate';

const LEADS = [0, 1, 7, 14] as const;
const LENGTHS = [3, 7, 10, 14] as const;

/**
 * Perfil → Modo férias: marcar um período (início e duração) ou encerrar o atual. Nos dias de
 * férias as missões somem e o streak fica guardado; o banco confere as regras.
 */
export function VacationSettings() {
  const { t, locale } = useT();
  const { today } = useToday();
  const load = useCallback(() => listVacations(), []);
  const list = useFocusLoad<Vacation[]>(load);
  const [lead, setLead] = useState<number>(0);
  const [days, setDays] = useState<number>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (list.loading) return <ActivityIndicator color={colors.primary} />;
  if (list.failed) {
    return (
      <>
        <FormMessage text={list.error} />
        <Button title={t('common.retry')} onPress={list.refresh} variant="secondary" />
      </>
    );
  }
  const vacations = list.data ?? [];
  const current = currentOrNextVacation(vacations, today);
  const year = Number(today.slice(0, 4));
  const used = vacationDaysInYear(vacations, year);

  function changed() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void syncReminders().catch(() => undefined);
    list.refresh();
  }

  async function start() {
    const startDate = addDays(today, lead);
    const invalid = validateVacation(startDate, days, today, vacations, locale);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const r = await startVacation(startDate, days);
    setBusy(false);
    if (r.error !== null) return setError(r.error);
    changed();
  }

  function confirmEnd(v: Vacation) {
    const effect = endVacationEffect(v, today);
    Alert.alert(
      effect.kind === 'delete' ? t('vacation.cancelTitle') : t('vacation.endTitle'),
      effect.kind === 'delete' ? t('vacation.cancelText') : t('vacation.endText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: effect.kind === 'delete' ? t('vacation.cancelButton') : t('vacation.endNow'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            const r = await endVacation(v.id);
            setBusy(false);
            if (r.error !== null) return setError(r.error);
            changed();
          },
        },
      ],
    );
  }

  const range = (start: string, end: string) =>
    t('vacation.range', {
      start: formatShortDate(start, locale),
      end: formatShortDate(end, locale),
    });

  if (current) {
    const started = current.startDate <= today;
    return (
      <View style={styles.card}>
        <Text style={typography.body}>
          {started ? t('vacation.activeNow') : t('vacation.scheduled')}{' '}
          {range(current.startDate, current.endDate)}
        </Text>
        <Text style={typography.caption}>
          {t('vacation.lengthUsed', {
            days: vacationLength(current),
            used,
            max: VACATION_DAYS_PER_YEAR,
            year,
          })}
        </Text>
        <FormMessage text={error} />
        <Button
          title={started ? t('vacation.endNow') : t('vacation.cancelButton')}
          onPress={() => confirmEnd(current)}
          variant="secondary"
          loading={busy}
        />
      </View>
    );
  }

  const startDate = addDays(today, lead);
  const leadLabel = (n: number) =>
    n === 0
      ? t('vacation.leadToday')
      : n === 1
        ? t('vacation.leadTomorrow')
        : t('vacation.leadDays', { days: n });

  return (
    <View style={styles.form}>
      <Text style={typography.caption}>{t('vacation.intro')}</Text>
      <Text style={typography.label}>{t('vacation.starts')}</Text>
      <Chips
        options={LEADS.map((n) => ({ value: n as number, label: leadLabel(n) }))}
        selected={[lead]}
        onToggle={setLead}
      />
      <Text style={typography.label}>{t('vacation.lasts')}</Text>
      <Chips
        options={LENGTHS.map((n) => ({ value: n as number, label: t('vacation.days', { days: n }) }))}
        selected={[days]}
        onToggle={setDays}
      />
      <Text style={typography.body}>{range(startDate, addDays(startDate, days - 1))}</Text>
      <Text style={typography.caption}>
        {t('vacation.usedThisYear', { used, max: VACATION_DAYS_PER_YEAR, year })}
      </Text>
      <FormMessage text={error} />
      <Button title={t('vacation.start')} onPress={start} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  form: { gap: spacing.sm },
});
