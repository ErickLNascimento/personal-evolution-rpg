import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABEL,
  toggleScheduleDay,
  validateHabitDraft,
  validateObjectiveTitle,
  WEEKDAY_SHORT,
  xpForHabit,
  type HabitDraft,
  type HabitDraftErrors,
  type HabitInput,
  type ObjectiveCategory,
} from '@per/domain';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { colors, radius, spacing, typography } from '@/theme/tokens';
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

      <ObjectivePicker value={draft.objectiveId} onChange={(id) => set('objectiveId', id)} />

      <FormMessage text={error} />
      <Button title={submitLabel} onPress={submit} loading={saving} />
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
  error: { ...typography.caption, color: colors.danger },
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
});
