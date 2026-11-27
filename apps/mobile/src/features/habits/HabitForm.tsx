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
  DEFAULT_REMINDER_UNTIL,
  REMINDER_REPEAT_MINUTES,
  reminderTimesOfDay,
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
  // Objetivos ativos e a área da vida da missão (sem objetivo na área, um é criado ao salvar).
  const [objectives, setObjectives] = useState<ObjectiveRecord[]>([]);
  const [objectivesError, setObjectivesError] = useState<string | null>(null);
  const [area, setArea] = useState<ObjectiveCategory | null>(null);
  useEffect(() => {
    let active = true;
    listObjectives().then((r) => {
      if (!active) return;
      if (r.error !== null) return setObjectivesError(r.error);
      setObjectives(r.data);
      const current = r.data.find((o) => o.id === initial.objectiveId);
      if (current) setArea(current.category);
    });
    return () => {
      active = false;
    };
  }, [initial.objectiveId]);
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
  // Lembretes ao longo do dia: com a flag, ou se o hábito já repete (para poder desligar).
  const repeatOn = useFeature(FEATURES.reminderRepeat) || Boolean(initial.reminderEveryMinutes);

  async function submit() {
    const result = validateHabitDraft(draft, locale);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    let input = result.value;
    // Área escolhida sem objetivo: usa o primeiro objetivo ativo dela ou cria um com o nome da área.
    if (area && !input.objectiveId) {
      const existing = objectives.find((o) => o.category === area);
      if (existing) input = { ...input, objectiveId: existing.id };
      else {
        const r = await createObjective(OBJECTIVE_CATEGORY_LABELS[locale][area], area);
        if (r.error !== null) {
          setSaving(false);
          setError(r.error);
          return;
        }
        setObjectives((list) => [...list, r.data]);
        input = { ...input, objectiveId: r.data.id };
      }
    }
    setError(await onSubmit(input));
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

      {repeatOn && kind === 'count' && draft.reminderTime ? (
        <RepeatField
          start={draft.reminderTime}
          every={draft.reminderEveryMinutes ?? null}
          until={draft.reminderUntil ?? null}
          onChange={(every, until) =>
            setDraft((d) => ({ ...d, reminderEveryMinutes: every, reminderUntil: until }))
          }
          error={errors.reminderUntil}
        />
      ) : null}

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

      <ObjectivePicker
        value={draft.objectiveId}
        area={area}
        objectives={objectives}
        loadError={objectivesError}
        onChange={(id, a) => {
          set('objectiveId', id);
          setArea(a);
        }}
        onCreated={(o) => setObjectives((list) => [...list, o])}
      />

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

/** Lembrar ao longo do dia (missões de contar): intervalo e horário do último lembrete. */
function RepeatField({
  start,
  every,
  until,
  onChange,
  error,
}: {
  start: string;
  every: number | null;
  until: string | null;
  onChange: (every: number | null, until: string | null) => void;
  error?: string;
}) {
  const { t } = useT();
  const [androidOpen, setAndroidOpen] = useState(false);
  const on = every !== null;
  const end = parseReminderTime(until ?? DEFAULT_REMINDER_UNTIL);
  const pickerDate = new Date();
  pickerDate.setHours(end?.hour ?? 20, end?.minute ?? 0, 0, 0);
  const times = on
    ? reminderTimesOfDay({ id: '', title: '', scheduleDays: [], reminderTime: start, reminderEveryMinutes: every, reminderUntil: until })
    : [];

  function pick(date: Date) {
    setAndroidOpen(false);
    onChange(every, formatReminderTime({ hour: date.getHours(), minute: date.getMinutes() }));
  }

  const label = (m: number) =>
    m % 60 === 0 ? t('habitForm.repeatHours', { h: m / 60 }) : t('habitForm.repeatHoursHalf', { h: Math.floor(m / 60) });

  return (
    <View style={styles.group}>
      <View style={styles.switchRow}>
        <Ionicons name="repeat" size={18} color={on ? colors.primary : colors.textSecondary} />
        <Text style={[typography.label, styles.flex]}>{t('habitForm.repeat')}</Text>
        <Switch
          value={on}
          onValueChange={(v) => onChange(v ? 120 : null, v ? (until ?? DEFAULT_REMINDER_UNTIL) : null)}
          accessibilityLabel={t('habitForm.repeat')}
          trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
        />
      </View>
      {on && (
        <>
          <Chips
            options={REMINDER_REPEAT_MINUTES.map((m) => ({ value: m, label: label(m) }))}
            selected={[every]}
            onToggle={(m) => onChange(m, until ?? DEFAULT_REMINDER_UNTIL)}
          />
          <View style={styles.switchRow}>
            <Text style={[typography.body, styles.flex]}>{t('habitForm.repeatUntil')}</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={pickerDate}
                mode="time"
                display="compact"
                locale="pt-BR"
                themeVariant="dark"
                onValueChange={(_e, date) => pick(date)}
              />
            ) : (
              <Pressable
                onPress={() => setAndroidOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('habitForm.repeatUntilA11y', { time: until ?? DEFAULT_REMINDER_UNTIL })}
                style={styles.timeButton}
              >
                <Text style={typography.body}>{until ?? DEFAULT_REMINDER_UNTIL}</Text>
              </Pressable>
            )}
          </View>
          {androidOpen && Platform.OS !== 'ios' && (
            <DateTimePicker
              value={pickerDate}
              mode="time"
              is24Hour
              onValueChange={(_e, date) => pick(date)}
              onDismiss={() => setAndroidOpen(false)}
            />
          )}
          <Text style={typography.caption}>
            {t('habitForm.repeatSummary', {
              count: times.length,
              times: times.map(formatReminderTime).join(', '),
            })}
          </Text>
        </>
      )}
      {!on && <Text style={typography.caption}>{t('habitForm.repeatHint')}</Text>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function ObjectivePicker({
  value,
  area,
  objectives,
  loadError,
  onChange,
  onCreated,
}: {
  value: string | null;
  area: ObjectiveCategory | null;
  objectives: readonly ObjectiveRecord[];
  loadError: string | null;
  /** Objetivo (ou null) e área escolhidos. */
  onChange: (id: string | null, area: ObjectiveCategory | null) => void;
  onCreated: (o: ObjectiveRecord) => void;
}) {
  const { t, locale } = useT();
  const categoryOptions = useOptions().categories;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inArea = area ? objectives.filter((o) => o.category === area) : [];

  async function create() {
    if (!area) return;
    const { value: clean, error } = validateObjectiveTitle(title, locale);
    if (error) {
      setTitleError(error);
      return;
    }
    setSaving(true);
    const r = await createObjective(clean, area);
    setSaving(false);
    if (r.error !== null) {
      setTitleError(r.error);
      return;
    }
    onCreated(r.data);
    onChange(r.data.id, area);
    setCreating(false);
    setTitle('');
    setTitleError(null);
  }

  return (
    <View style={styles.group}>
      <Text style={typography.label}>{t('habitForm.area')}</Text>
      <Text style={typography.caption}>{t('habitForm.areaHint')}</Text>
      <Chips
        options={[{ value: NO_OBJECTIVE, label: t('habitForm.noArea') }, ...categoryOptions]}
        selected={[area ?? NO_OBJECTIVE]}
        onToggle={(v) => {
          const next = v === NO_OBJECTIVE ? null : (v as ObjectiveCategory);
          // Trocar de área tira o objetivo de outra área.
          const keep = objectives.find((o) => o.id === value)?.category === next ? value : null;
          onChange(next ? keep : null, next);
          setCreating(false);
        }}
      />
      <FormMessage text={loadError} />

      {area && (
        <View style={styles.panel}>
          <Text style={typography.label}>{t('habitForm.objectiveOptional')}</Text>
          {inArea.length > 0 ? (
            <Chips
              options={[
                { value: NO_OBJECTIVE, label: t('habitForm.areaGeneral') },
                ...inArea.map((o) => ({ value: o.id, label: o.title })),
              ]}
              selected={[value ?? NO_OBJECTIVE]}
              onToggle={(id) => onChange(id === NO_OBJECTIVE ? null : id, area)}
            />
          ) : (
            <Text style={typography.caption}>
              {t('habitForm.areaAuto', { area: OBJECTIVE_CATEGORY_LABELS[locale][area] })}
            </Text>
          )}
          {creating ? (
            <>
              <Field
                label={t('habitForm.newObjective')}
                value={title}
                onChangeText={setTitle}
                placeholder={t('habitForm.objectivePlaceholder')}
                maxLength={120}
                error={titleError}
              />
              <Button title={t('habitForm.createObjective')} onPress={create} loading={saving} />
              <Button
                title={t('common.cancel')}
                onPress={() => setCreating(false)}
                variant="secondary"
                disabled={saving}
              />
            </>
          ) : (
            <Button
              title={t('habitForm.newObjective')}
              onPress={() => setCreating(true)}
              variant="secondary"
            />
          )}
        </View>
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
