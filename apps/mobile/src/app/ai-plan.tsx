import { Ionicons } from '@expo/vector-icons';
import {
  canDecide,
  describeSchedule,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  estimateMissionCrystals,
  hasAiConsent,
  HERO_ATTRIBUTES,
  normalizePlanRequest,
  OBJECTIVE_CATEGORY_LABEL,
  PLAN_GOAL_MAX,
  PLAN_MINUTES_OPTIONS,
  PLAN_PAST_MAX,
  sanitizeHero,
  toggleScheduleDay,
  validateSuggestionEdit,
  WEEKDAY_SHORT,
  xpForHabit,
  type AiHabitSuggestion,
  type AiPlanKind,
  type Difficulty,
  type HeroClass,
  type PlanMinutes,
  type SuggestionEdit,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { CRYSTAL } from '@/components/crystals/Crystals';
import { Button, Field, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import {
  decidePlan,
  latestPlan,
  MAX_SWAPS,
  requestPlan,
  swapSuggestion,
  type AiPlan,
} from '@/features/ai/api';
import { useProfile } from '@/features/profile/useProfile';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const KIND_LABEL: Record<AiPlanKind, string> = {
  initial: 'Missões reveladas',
  weekly: 'Revisão semanal',
};
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_OPTIONS = WEEKDAY_SHORT.map((label, value) => ({ value, label }));
const MINUTE_OPTIONS = [
  { value: 0, label: 'Sem preferência' },
  ...PLAN_MINUTES_OPTIONS.map((m) => ({
    value: m as number,
    label: m === 60 ? '1 h' : `${m} min`,
  })),
];
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }));

type Draft = { title: string; difficulty: Difficulty; scheduleDays: number[] };

export default function AiPlanScreen() {
  const { profile, loading: profileLoading } = useProfile();
  const [plan, setPlan] = useState<AiPlan | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<number, Draft>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulário do pedido (o objetivo pode vir da tela Nova missão)
  const params = useLocalSearchParams<{ goal?: string }>();
  const [goal, setGoal] = useState(
    typeof params.goal === 'string' ? params.goal.slice(0, PLAN_GOAL_MAX) : '',
  );
  const [minutes, setMinutes] = useState<number>(0);
  const [freeDays, setFreeDays] = useState<number[]>(ALL_DAYS);
  const [past, setPast] = useState('');

  const showPlan = useCallback((p: AiPlan | null) => {
    setPlan(p);
    setSelected(new Set(p ? p.suggestions.map((s) => s.index) : []));
    setEdits({});
    setEditing(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      latestPlan().then((r) => {
        if (!active) return;
        setError(r.error);
        showPlan(r.data);
      });
      return () => {
        active = false;
      };
    }, [showPlan]),
  );

  if (profileLoading || plan === undefined) {
    return (
      <StackScreen>
        {error ? <FormMessage text={error} /> : <ActivityIndicator color={colors.primary} />}
      </StackScreen>
    );
  }

  if (!profile || !hasAiConsent(profile)) {
    return (
      <StackScreen>
        <Text style={typography.body}>
          Para receber sugestões, ative “Permitir que a IA use meus dados” no Perfil. Seus
          objetivos, hábitos e registros (sem nome nem e-mail) vão para os provedores de IA (Google
          Gemini e, como reserva, Groq). A IA só propõe: nada muda sem a sua aprovação, e ela nunca
          altera seu XP.
        </Text>
        <Button title="Ir para o Perfil" onPress={() => router.navigate('/profile')} />
      </StackScreen>
    );
  }

  // Classe equipada (para mostrar os Cristais com o bônus dela)
  const heroClass: HeroClass = sanitizeHero(profile.hero, 999, profile.owned).heroClass;

  async function generate(kind: AiPlanKind) {
    const req = normalizePlanRequest({
      goal,
      minutesPerDay: minutes === 0 ? null : (minutes as PlanMinutes),
      freeDays,
      pastAttempts: past,
    });
    if (req.error !== null || !req.value) {
      setError(req.error);
      return;
    }
    setBusy(kind);
    setError(null);
    setNotice(null);
    const r = await requestPlan(kind, req.value);
    setBusy(null);
    if (r.error !== null) {
      setError(r.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showPlan(r.data);
  }

  async function swap(current: AiPlan, index: number) {
    setBusy(`swap-${index}`);
    setError(null);
    const r = await swapSuggestion(current.id, index);
    setBusy(null);
    if (r.error !== null) {
      setError(r.error);
      return;
    }
    void Haptics.selectionAsync();
    setPlan(r.data);
    setEdits((e) => {
      const next = { ...e };
      delete next[index];
      return next;
    });
    setEditing(null);
  }

  async function decide(current: AiPlan, accept: boolean) {
    const chosen = [...selected];
    const editList: SuggestionEdit[] = [];
    if (accept) {
      for (const i of chosen) {
        const d = edits[i];
        if (!d) continue;
        const v = validateSuggestionEdit(i, d);
        if (v.error !== null || !v.value) {
          setError(`Sugestão ${i + 1}: ${v.error}`);
          setEditing(i);
          return;
        }
        editList.push(v.value);
      }
    }
    setBusy('decide');
    setError(null);
    const r = await decidePlan(current.id, accept, accept ? chosen : [], editList);
    setBusy(null);
    if (r.error !== null) {
      setError(r.error);
      return;
    }
    setPlan({ ...current, status: accept ? 'accepted' : 'rejected' });
    setEditing(null);
    setNotice(
      accept
        ? r.data.habitsCreated === 0
          ? 'Plano aceito, sem novos hábitos.'
          : `${r.data.habitsCreated} ${r.data.habitsCreated === 1 ? 'hábito criado' : 'hábitos criados'}. Eles já aparecem nas missões.`
        : 'Plano recusado. Nada foi alterado.',
    );
  }

  function confirmReject(current: AiPlan) {
    Alert.alert('Recusar as sugestões?', 'Nenhum hábito será criado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Recusar', style: 'destructive', onPress: () => void decide(current, false) },
    ]);
  }

  const pending = plan && canDecide(plan.status);
  const generating = busy === 'initial' || busy === 'weekly';
  const swapsLeft = plan ? MAX_SWAPS - plan.swaps : 0;

  return (
    <StackScreen>
      <FormMessage text={notice} tone="info" />
      <FormMessage text={error} />

      {generating && (
        <View style={styles.thinking} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={[typography.body, styles.flex]}>O Oráculo está lendo sua jornada…</Text>
        </View>
      )}

      {plan && !generating && (
        <View style={styles.card}>
          <Text style={typography.label}>
            {KIND_LABEL[plan.kind].toUpperCase()} ·{' '}
            {new Date(plan.createdAt).toLocaleDateString('pt-BR')}
          </Text>
          {plan.summary ? <Text style={typography.body}>{plan.summary}</Text> : null}
          {!pending && (
            <Text style={typography.caption}>
              {plan.status === 'accepted' ? 'Você aceitou este plano.' : 'Você recusou este plano.'}
            </Text>
          )}
        </View>
      )}

      {plan && pending && !generating && (
        <>
          {plan.suggestions.length === 0 ? (
            <Text style={typography.caption}>
              Sem hábitos novos desta vez: continue com a rotina atual.
            </Text>
          ) : (
            <Text style={typography.caption}>
              Escolha o que quer adicionar. Ajuste ou troque o que não combinar com você
              {swapsLeft > 0
                ? ` (${swapsLeft} ${swapsLeft === 1 ? 'troca restante' : 'trocas restantes'})`
                : ''}
              .
            </Text>
          )}
          {plan.suggestions.map((s) => (
            <SuggestionRow
              key={`${s.index}-${s.title}`}
              suggestion={s}
              draft={edits[s.index]}
              heroClass={heroClass}
              checked={selected.has(s.index)}
              editing={editing === s.index}
              swapping={busy === `swap-${s.index}`}
              canSwap={swapsLeft > 0 && busy === null}
              onToggle={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.index)) next.delete(s.index);
                  else next.add(s.index);
                  return next;
                })
              }
              onEdit={() => {
                setEdits((e) =>
                  e[s.index]
                    ? e
                    : {
                        ...e,
                        [s.index]: {
                          title: s.title,
                          difficulty: s.difficulty,
                          scheduleDays: s.scheduleDays,
                        },
                      },
                );
                setEditing(editing === s.index ? null : s.index);
              }}
              onChange={(d) => setEdits((e) => ({ ...e, [s.index]: d }))}
              onSwap={() => void swap(plan, s.index)}
            />
          ))}
          <Button
            title={
              plan.suggestions.length === 0
                ? 'Ok, entendi'
                : selected.size === 0
                  ? 'Selecione ao menos um'
                  : `Adicionar ${selected.size} ${selected.size === 1 ? 'hábito' : 'hábitos'}`
            }
            onPress={() => decide(plan, true)}
            loading={busy === 'decide'}
            disabled={
              (plan.suggestions.length > 0 && selected.size === 0) ||
              (busy !== null && busy !== 'decide')
            }
          />
          {plan.suggestions.length > 0 && (
            <Button
              title="Recusar"
              onPress={() => confirmReject(plan)}
              variant="secondary"
              disabled={busy !== null}
            />
          )}
        </>
      )}

      {!pending && !generating && (
        <View style={styles.actions}>
          <Text style={typography.label}>CONTE O QUE VOCÊ QUER</Text>
          <Text style={typography.caption}>
            Tudo opcional. Quanto mais você contar, mais o plano combina com a sua vida.
          </Text>
          <Field
            label="O que você quer conquistar?"
            value={goal}
            onChangeText={setGoal}
            placeholder="Escreva com as suas palavras"
            maxLength={PLAN_GOAL_MAX}
            multiline
          />
          <Text style={typography.label}>TEMPO POR DIA</Text>
          <Chips options={MINUTE_OPTIONS} selected={[minutes]} onToggle={setMinutes} />
          <Text style={typography.label}>DIAS LIVRES</Text>
          <Chips
            multiple
            options={DAY_OPTIONS}
            selected={freeDays}
            onToggle={(d) => setFreeDays((cur) => toggleScheduleDay(cur, d))}
          />
          <Field
            label="Algo que já tentou e não deu certo?"
            value={past}
            onChangeText={setPast}
            placeholder="Conte com as suas palavras"
            maxLength={PLAN_PAST_MAX}
            multiline
          />

          <Text style={[typography.label, styles.spaced]}>CONSULTAR O ORÁCULO</Text>
          <Button
            title="Revelar missões"
            onPress={() => generate('initial')}
            disabled={busy !== null}
          />
          <Text style={typography.caption}>
            O Oráculo sugere de 2 a 5 missões a partir do que você contou.
          </Text>
          <Button
            title="Revisar minha semana"
            onPress={() => generate('weekly')}
            variant="secondary"
            disabled={busy !== null}
          />
          <Text style={typography.caption}>
            O Oráculo lê seus últimos 14 dias e sugere ajustes.
          </Text>
        </View>
      )}
    </StackScreen>
  );
}

function SuggestionRow({
  suggestion,
  draft,
  heroClass,
  checked,
  editing,
  swapping,
  canSwap,
  onToggle,
  onEdit,
  onChange,
  onSwap,
}: {
  suggestion: AiHabitSuggestion;
  draft?: Draft;
  heroClass: HeroClass;
  checked: boolean;
  editing: boolean;
  swapping: boolean;
  canSwap: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChange: (d: Draft) => void;
  onSwap: () => void;
}) {
  const s = suggestion;
  const title = draft?.title ?? s.title;
  const difficulty = draft?.difficulty ?? s.difficulty;
  const days = draft?.scheduleDays ?? s.scheduleDays;
  const meta = `${DIFFICULTY_LABEL[difficulty]} · ${describeSchedule(days)}`;
  const objective = s.objectiveTitle
    ? `${s.objectiveTitle} (${OBJECTIVE_CATEGORY_LABEL[s.objectiveCategory]})`
    : null;
  const crystals = estimateMissionCrystals(difficulty, s.objectiveCategory, heroClass);
  const reward = `+${xpForHabit(difficulty)} XP · +${crystals} Cristais · treina ${HERO_ATTRIBUTES[s.objectiveCategory].label}`;

  return (
    <View style={[styles.row, checked && styles.rowChecked]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${title}, ${meta}. ${reward}${objective ? `, objetivo ${objective}` : ''}`}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={26}
          color={checked ? colors.primary : colors.textSecondary}
        />
        <View style={styles.body}>
          <Text style={typography.body}>
            {title}
            {draft ? <Text style={styles.edited}> · ajustado</Text> : null}
          </Text>
          <Text style={typography.caption}>{meta}</Text>
          <Text style={styles.reward}>{reward}</Text>
          {objective ? <Text style={styles.objective}>◆ {objective}</Text> : null}
          {s.rationale ? <Text style={typography.caption}>{s.rationale}</Text> : null}
        </View>
      </Pressable>

      <View style={styles.rowActions}>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Ajustar ${title}`}
          style={styles.smallButton}
        >
          <Ionicons
            name={editing ? 'chevron-up' : 'create-outline'}
            size={15}
            color={colors.text}
          />
          <Text style={styles.smallText}>{editing ? 'Fechar' : 'Ajustar'}</Text>
        </Pressable>
        <Pressable
          onPress={onSwap}
          disabled={!canSwap}
          accessibilityRole="button"
          accessibilityLabel={`Trocar ${title} por outra sugestão`}
          style={[styles.smallButton, !canSwap && styles.disabled]}
        >
          {swapping ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="refresh" size={15} color={colors.text} />
          )}
          <Text style={styles.smallText}>Trocar</Text>
        </Pressable>
      </View>

      {editing && draft && (
        <View style={styles.editor}>
          <Field
            label="Nome"
            value={draft.title}
            onChangeText={(t) => onChange({ ...draft, title: t })}
            maxLength={120}
          />
          <Text style={typography.label}>DIFICULDADE</Text>
          <Chips
            options={DIFFICULTY_OPTIONS}
            selected={[draft.difficulty]}
            onToggle={(d) => onChange({ ...draft, difficulty: d })}
          />
          <Text style={typography.label}>DIAS</Text>
          <Chips
            multiple
            options={DAY_OPTIONS}
            selected={draft.scheduleDays}
            onToggle={(d) =>
              onChange({ ...draft, scheduleDays: toggleScheduleDay(draft.scheduleDays, d) })
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  spaced: { marginTop: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { gap: spacing.sm },
  row: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowChecked: { borderColor: colors.primary },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
  },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  edited: { ...typography.caption, color: colors.accent },
  reward: { fontSize: 13, fontWeight: '700', color: CRYSTAL },
  objective: { ...typography.caption, color: colors.primary },
  rowActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  smallButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallText: { fontSize: 13, fontWeight: '700', color: colors.text },
  disabled: { opacity: 0.4 },
  editor: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
