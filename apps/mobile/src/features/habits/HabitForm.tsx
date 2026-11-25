import { Ionicons } from '@expo/vector-icons';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FEATURES,
  HABIT_KIND_HINTS,
  HABIT_KIND_LABELS,
  HABIT_KINDS,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABELS,
  toggleScheduleDay,
  validateHabitDraft,
  formatReminderTime,
  parseReminderTime,
  validateObjectiveTitle,
  WEEKDAY_SHORTS,
  xpForHabit,
  type HabitDraft,
  type HabitDraftErrors,
  type HabitInput,
  type ObjectiveCategory,
} from '@per/domain';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { useFeature } from '@/features/profile/useFeature';
import { ensureReminderPermission } from '@/lib/reminders';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { createObjective, listObjectives, type ObjectiveRecord } from './api';
import { useT } from '@/i18n';

const NO_OBJECTIVE = '__none__';

/** Opções dos seletores no idioma atual. */
function useOptions() {
  const { t, locale } = useT();
  const fullDays = t('habitForm.weekdaysFull').split(',');
  return {
    days: WEEKDAY_SHORTS[locale].map((label, value) => ({
      value,
      label,
      accessibilityLabel: fullDays[value],
    })),
    difficulties: DIFFICULTIES.map((d) => ({
      value: d,
      label: `${DIFFICULTY_LABELS[locale][d]} · ${xpForHabit(d)} XP`,
    })),
    categories: OBJECTIVE_CATEGORIES.map((c) => ({
      value: c,
      label: OBJECTIVE_CATEGORY_LABELS[locale][c],
    })),
    kinds: HABIT_KINDS.map((k) => ({ value: k, label: HABIT_KIND_LABELS[locale][k] })),
  };
}

export const EMPTY_DRAFT: HabitDraft = {
  title: '',
  kind: 'do',
  difficulty: 'easy',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  objectiveId: null,
  targetQty: '',
  unit: '',
  reminderTime: null,
};

export function HabitForm({
  initial,
  submitLabel,
  onSubmit,
  onConsultOracle,
}: {
  initial: HabitDraft;
  submitLabel: string;
  /** Devolve mensagem de erro, ou `null` se salvou. */
  onSubmit: (input: HabitInput) => Promise<string | null>;
  /** Se presente, mostra o atalho sutil para pedir ajuda ao Oráculo (com o que já foi escrito). */
  onConsultOracle?: (title: string) => void;
}) {
  const { t, locale } = useT();
  const options = useOptions();
  const [draft, setDraft] = useState<HabitDraft>(initial);
  // Meta diária fica escondida até a pessoa pedir (ou se o hábito já tiver uma).
  const [showTarget, setShowTarget] = useState(Boolean(initial.targetQty || initial.unit));
  const [errors, setErrors] = useState<HabitDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const kind = draft.kind ?? 'do';
  // Desligado, some o seletor; hábitos que já são Evitar/Contar seguem editáveis.
  const kindsOn = useFeature(FEATURES.habitKinds) || (initial.kind ?? 'do') !== 'do';

  async function submit() {
    const result = validateHabitDraft(draft, locale);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    setError(await onSubmit(result.value));
    setSaving(false);
  }

  return (
    <View style={styles.form}>
      <Field
        label={t('habitForm.name')}
        value={draft.title}
        onChangeText={(v) => set('title', v)}
        placeholder={t('habitForm.namePlaceholder')}
        maxLength={120}
        error={errors.title}
      />
      {onConsultOracle && (
        <Pressable
          onPress={() => onConsultOracle(draft.title)}
          accessibilityRole="button"
          accessibilityLabel={t('habitForm.oracleA11y')}
          style={({ pressed }) => [styles.oracle, pressed && styles.pressed]}
        >
          <Text style={styles.oracleText}>{t('habitForm.oracleLink')}</Text>
        </Pressable>
      )}

      {kindsOn && (
        <View style={styles.group}>
          <Text style={typography.label}>{t('habitForm.kind')}</Text>
          <Chips options={options.kinds} selected={[kind]} onToggle={(v) => set('kind', v)} />
          <Text style={typography.caption}>{HABIT_KIND_HINTS[locale][kind]}</Text>
        </View>
      )}

      <View style={styles.group}>
        <Text style={typography.label}>{t('habitForm.difficulty')}</Text>
        <Chips
          options={options.difficulties}
          selected={[draft.difficulty]}
          onToggle={(v) => set('difficulty', v)}
        />
      </View>

      <View style={styles.group}>
        <Text style={typography.label}>{t('habitForm.weekdays')}</Text>
        <Chips
          multiple
          options={options.days}
          selected={draft.scheduleDays}
          onToggle={(day) => set('scheduleDays', toggleScheduleDay(draft.scheduleDays, day))}
        />
        {errors.scheduleDays ? <Text style={styles.error}>{errors.scheduleDays}</Text> : null}
      </View>

      <ReminderField
        value={draft.reminderTime ?? null}
        onChange={(v) => set('reminderTime', v)}
        error={errors.reminderTime}
      />

      {kind === 'avoid' ? null : kind === 'count' || showTarget ? (
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field
                label={kind === 'count' ? t('habitForm.timesPerDay') : t('habitForm.targetPerDay')}
                value={draft.targetQty}
                onChangeText={(v) => set('targetQty', v)}
                placeholder={
                  kind === 'count' ? t('habitForm.countPlaceholder') : t('habitForm.qtyPlaceholder')
                }
                keyboardType={kind === 'count' ? 'number-pad' : 'decimal-pad'}
                error={errors.targetQty}
              />
            </View>
            <View style={styles.flex}>
              <Field
                label={t('habitForm.unit')}
                value={draft.unit}
                onChangeText={(v) => set('unit', v)}
                placeholder={
                  kind === 'count'
                    ? t('habitForm.unitCountPlaceholder')
                    : t('habitForm.unitPlaceholder')
                }
                maxLength={20}
                error={errors.unit}
              />
            </View>
          </View>
          {kind === 'count' ? null : (
            <Pressable
              onPress={() => {
                set('targetQty', '');
                set('unit', '');
                setShowTarget(false);
              }}
              accessibilityRole="button"
              style={styles.linkButton}
            >
              <Text style={typography.caption}>{t('habitForm.removeTarget')}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          onPress={() => setShowTarget(true)}
          accessibilityRole="button"
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>{t('habitForm.addTarget')}</Text>
        </Pressable>
      )}

      <ObjectivePicker value={draft.objectiveId} onChange={(id) => set('objectiveId', id)} />

      <FormMessage text={error} />
      <Button title={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}

const DEFAULT_REMINDER = '08:00';

/** Liga/desliga o lembrete e escolhe o horário. Pede permissão de notificação ao ligar. */
function ReminderField({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}) {
  const { t } = useT();
  const [denied, setDenied] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const time = parseReminderTime(value);
  const pickerDate = new Date();
  pickerDate.setHours(time?.hour ?? 8, time?.minute ?? 0, 0, 0);

  async function toggle(on: boolean) {
    if (!on) {
      onChange(null);
      return;
    }
    const allowed = await ensureReminderPermission();
    setDenied(!allowed);
    if (allowed) onChange(value ?? DEFAULT_REMINDER);
  }

  function pick(date: Date) {
    setAndroidOpen(false);
    onChange(formatReminderTime({ hour: date.getHours(), minute: date.getMinutes() }));
  }

  return (
    <View style={styles.group}>
      <View style={styles.switchRow}>
        <Ionicons
          name="notifications-outline"
          size={18}
          color={time ? colors.primary : colors.textSecondary}
        />
        <Text style={[typography.label, styles.flex]}>{t('habitForm.reminder')}</Text>
        <Switch
          value={time !== null}
          onValueChange={(on) => void toggle(on)}
          accessibilityLabel={t('habitForm.reminder')}
          trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
        />
      </View>
      {time && Platform.OS === 'ios' && (
        <View style={styles.switchRow}>
          <Text style={[typography.body, styles.flex]}>{t('habitForm.reminderTime')}</Text>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            display="compact"
            locale="pt-BR"
            themeVariant="dark"
            onValueChange={(_e, date) => pick(date)}
          />
        </View>
      )}
      {time && Platform.OS !== 'ios' && (
        <>
          <Pressable
            onPress={() => setAndroidOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('habitForm.reminderA11y', { time: value ?? '' })}
            style={styles.timeButton}
          >
            <Text style={typography.body}>{value}</Text>
          </Pressable>
          {androidOpen && (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              is24Hour
              onValueChange={(_e, date) => pick(date)}
              onDismiss={() => setAndroidOpen(false)}
            />
          )}
        </>
      )}
      <Text style={typography.caption}>
        {denied
          ? t('habitForm.reminderBlocked')
          : time
            ? t('habitForm.reminderOn')
            : t('habitForm.reminderOff')}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function ObjectivePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { t, locale } = useT();
  const categoryOptions = useOptions().categories;
  const [objectives, setObjectives] = useState<ObjectiveRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ObjectiveCategory>('health');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    listObjectives().then((r) => {
      if (!active) return;
      if (r.error !== null) setLoadError(r.error);
      else setObjectives(r.data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function create() {
    const { value: clean, error } = validateObjectiveTitle(title, locale);
    if (error) {
      setTitleError(error);
      return;
    }
    setSaving(true);
    const r = await createObjective(clean, category);
    setSaving(false);
    if (r.error !== null) {
      setTitleError(r.error);
      return;
    }
    setObjectives((list) => [...list, r.data]);
    onChange(r.data.id);
    setCreating(false);
    setTitle('');
    setTitleError(null);
  }

  const options = [
    { value: NO_OBJECTIVE, label: t('habitForm.noObjective') },
    ...objectives.map((o) => ({ value: o.id, label: o.title })),
  ];

  return (
    <View style={styles.group}>
      <Text style={typography.label}>{t('habitForm.objective')}</Text>
      <Text style={typography.caption}>{t('habitForm.objectiveHint')}</Text>
      <Chips
        options={options}
        selected={[value ?? NO_OBJECTIVE]}
        onToggle={(id) => onChange(id === NO_OBJECTIVE ? null : id)}
      />
      <FormMessage text={loadError} />

      {creating ? (
        <View style={styles.panel}>
          <Field
            label={t('habitForm.newObjective')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('habitForm.objectivePlaceholder')}
            maxLength={120}
            error={titleError}
          />
          <Text style={typography.label}>{t('habitForm.category')}</Text>
          <Chips options={categoryOptions} selected={[category]} onToggle={setCategory} />
          <Button title={t('habitForm.createObjective')} onPress={create} loading={saving} />
          <Button
            title={t('common.cancel')}
            onPress={() => setCreating(false)}
            variant="secondary"
            disabled={saving}
          />
        </View>
      ) : (
        <Button
          title={t('habitForm.newObjective')}
          onPress={() => setCreating(true)}
          variant="secondary"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  oracle: { minHeight: MIN_TOUCH - 8, justifyContent: 'center' },
  oracleText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  linkButton: { minHeight: MIN_TOUCH - 8, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  timeButton: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  error: { ...typography.caption, color: colors.danger },
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
});
