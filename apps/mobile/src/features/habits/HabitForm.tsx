import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABEL,
  toggleScheduleDay,
  validateHabitDraft,
  formatReminderTime,
  parseReminderTime,
  validateObjectiveTitle,
  WEEKDAY_SHORT,
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
import { ensureReminderPermission } from '@/lib/reminders';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { createObjective, listObjectives, type ObjectiveRecord } from './api';

const WEEKDAY_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DAY_OPTIONS = WEEKDAY_SHORT.map((label, value) => ({ value, label, accessibilityLabel: WEEKDAY_FULL[value] }));
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: `${DIFFICULTY_LABEL[d]} · ${xpForHabit(d)} XP` }));
const CATEGORY_OPTIONS = OBJECTIVE_CATEGORIES.map((c) => ({ value: c, label: OBJECTIVE_CATEGORY_LABEL[c] }));
const NO_OBJECTIVE = '__none__';

export const EMPTY_DRAFT: HabitDraft = {
  title: '',
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
}: {
  initial: HabitDraft;
  submitLabel: string;
  /** Devolve mensagem de erro, ou `null` se salvou. */
  onSubmit: (input: HabitInput) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<HabitDraft>(initial);
  const [errors, setErrors] = useState<HabitDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof HabitDraft>(key: K, value: HabitDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit() {
    const result = validateHabitDraft(draft);
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
        label="Nome do hábito"
        value={draft.title}
        onChangeText={(v) => set('title', v)}
        placeholder="Ex.: Ler 10 páginas"
        maxLength={120}
        error={errors.title}
      />

      <View style={styles.group}>
        <Text style={typography.label}>DIFICULDADE</Text>
        <Chips options={DIFFICULTY_OPTIONS} selected={[draft.difficulty]} onToggle={(v) => set('difficulty', v)} />
      </View>

      <View style={styles.group}>
        <Text style={typography.label}>DIAS DA SEMANA</Text>
        <Chips
          multiple
          options={DAY_OPTIONS}
          selected={draft.scheduleDays}
          onToggle={(day) => set('scheduleDays', toggleScheduleDay(draft.scheduleDays, day))}
        />
        {errors.scheduleDays ? <Text style={styles.error}>{errors.scheduleDays}</Text> : null}
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Field
            label="Meta por dia"
            value={draft.targetQty}
            onChangeText={(v) => set('targetQty', v)}
            placeholder="Opcional"
            keyboardType="decimal-pad"
            error={errors.targetQty}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Unidade"
            value={draft.unit}
            onChangeText={(v) => set('unit', v)}
            placeholder="páginas, km…"
            maxLength={20}
            error={errors.unit}
          />
        </View>
      </View>

      <ReminderField value={draft.reminderTime ?? null} onChange={(v) => set('reminderTime', v)} error={errors.reminderTime} />

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
        <Text style={[typography.label, styles.flex]}>LEMBRETE</Text>
        <Switch
          value={time !== null}
          onValueChange={(on) => void toggle(on)}
          accessibilityLabel="Lembrete"
          trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
        />
      </View>
      {time && Platform.OS === 'ios' && (
        <View style={styles.switchRow}>
          <Text style={[typography.body, styles.flex]}>Horário</Text>
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
            accessibilityLabel={`Horário do lembrete: ${value}`}
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
          ? 'As notificações estão bloqueadas. Ative-as nos Ajustes do aparelho para usar lembretes.'
          : time
            ? 'Você recebe um aviso neste aparelho nos dias da agenda, mesmo que a missão já esteja feita.'
            : 'Receba um aviso no horário escolhido, nos dias da agenda.'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function ObjectivePicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
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
    const { value: clean, error } = validateObjectiveTitle(title);
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
    { value: NO_OBJECTIVE, label: 'Nenhum' },
    ...objectives.map((o) => ({ value: o.id, label: o.title })),
  ];

  return (
    <View style={styles.group}>
      <Text style={typography.label}>OBJETIVO</Text>
      <Text style={typography.caption}>Ligue o hábito a um objetivo para ver o que cada missão ajuda a conquistar.</Text>
      <Chips
        options={options}
        selected={[value ?? NO_OBJECTIVE]}
        onToggle={(id) => onChange(id === NO_OBJECTIVE ? null : id)}
      />
      <FormMessage text={loadError} />

      {creating ? (
        <View style={styles.panel}>
          <Field
            label="Novo objetivo"
            value={title}
            onChangeText={setTitle}
            placeholder="Ex.: Ter mais saúde"
            maxLength={120}
            error={titleError}
          />
          <Text style={typography.label}>CATEGORIA</Text>
          <Chips options={CATEGORY_OPTIONS} selected={[category]} onToggle={setCategory} />
          <Button title="Criar objetivo" onPress={create} loading={saving} />
          <Button title="Cancelar" onPress={() => setCreating(false)} variant="secondary" disabled={saving} />
        </View>
      ) : (
        <Button title="Novo objetivo" onPress={() => setCreating(true)} variant="secondary" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
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
