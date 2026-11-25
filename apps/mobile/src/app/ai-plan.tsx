import { Ionicons } from '@expo/vector-icons';
import {
  canDecide,
  describeSchedule,
  attributeLabel,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  estimateMissionCrystals,
  hasAiConsent,
  normalizePlanRequest,
  OBJECTIVE_CATEGORY_LABELS,
  PLAN_GOAL_MAX,
  PLAN_MINUTES_OPTIONS,
  PLAN_PAST_MAX,
  heroLook,
  toggleScheduleDay,
  validateSuggestionEdit,
  WEEKDAY_SHORTS,
  xpForHabit,
  type AiHabitSuggestion,
  type AiPlanKind,
  type Difficulty,
  type HeroClass,
  type Locale,
  type PlanMinutes,
  type SuggestionEdit,
  FEATURES,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { CRYSTAL } from '@/components/crystals/Crystals';
import { Button, Field, FormMessage } from '@/components/Form';
import { OracleHeader } from '@/components/oracle/OracleHeader';
import { FeatureGate } from '@/components/FeatureGate';
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
import { useT, type TKey } from '@/i18n';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const KIND_LABEL: Record<AiPlanKind, TKey> = {
  initial: 'aiPlan.kindInitial',
  weekly: 'aiPlan.kindWeekly',
};
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const dayOptions = (locale: Locale) =>
  WEEKDAY_SHORTS[locale].map((label, value) => ({ value, label }));
const difficultyOptions = (locale: Locale) =>
  DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[locale][d] }));

type Draft = { title: string; difficulty: Difficulty; scheduleDays: number[] };

function AiPlanScreen() {
  const { profile, loading: profileLoading } = useProfile();
  const { t, locale } = useT();
  const minuteOptions = [
    { value: 0, label: t('aiPlan.noPreference') },
    ...PLAN_MINUTES_OPTIONS.map((m) => ({
      value: m as number,
      label: m === 60 ? '1 h' : `${m} min`,
    })),
  ];
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
        <OracleHeader says={t('aiPlan.consentSays')} />
        <Text style={typography.body}>{t('aiPlan.consentBody')}</Text>
        <Button title={t('aiPlan.goProfile')} onPress={() => router.navigate('/profile')} />
      </StackScreen>
    );
  }

  // Classe equipada (para mostrar os Cristais com o bônus dela)
  const heroClass: HeroClass = heroLook(profile.hero, 999, profile.heroPath).heroClass;

  async function generate(kind: AiPlanKind) {
    const req = normalizePlanRequest(
      {
        goal,
        minutesPerDay: minutes === 0 ? null : (minutes as PlanMinutes),
        freeDays,
        pastAttempts: past,
      },
      locale,
    );
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
        const v = validateSuggestionEdit(i, d, locale);
        if (v.error !== null || !v.value) {
          setError(t('aiPlan.suggestionError', { n: i + 1, error: v.error ?? '' }));
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
          ? t('aiPlan.acceptedNone')
          : t(r.data.habitsCreated === 1 ? 'aiPlan.createdOne' : 'aiPlan.createdMany', {
              count: r.data.habitsCreated,
            })
        : t('aiPlan.rejected'),
    );
  }

  function confirmReject(current: AiPlan) {
    Alert.alert(t('aiPlan.rejectTitle'), t('aiPlan.rejectText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('aiPlan.reject'), style: 'destructive', onPress: () => void decide(current, false) },
    ]);
  }

  const pending = plan && canDecide(plan.status);
  const generating = busy === 'initial' || busy === 'weekly';
  const swapsLeft = plan ? MAX_SWAPS - plan.swaps : 0;

  const oracleSays = generating
    ? t('aiPlan.saysReading')
    : plan && pending
      ? t('aiPlan.saysPlan')
      : t('aiPlan.saysIdle');

  return (
    <StackScreen>
      <OracleHeader says={oracleSays} />
      <FormMessage text={notice} tone="info" />
      <FormMessage text={error} />

      {generating && (
        <View style={styles.thinking} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={[typography.body, styles.flex]}>{t('aiPlan.thinking')}</Text>
        </View>
      )}

      {plan && !generating && (
        <View style={styles.card}>
          <Text style={typography.label}>
            {t(KIND_LABEL[plan.kind]).toUpperCase()} ·{' '}
            {new Date(plan.createdAt).toLocaleDateString(locale)}
          </Text>
          {plan.summary ? <Text style={typography.body}>{plan.summary}</Text> : null}
          {!pending && (
            <Text style={typography.caption}>
              {plan.status === 'accepted' ? t('aiPlan.youAccepted') : t('aiPlan.youRejected')}
            </Text>
          )}
        </View>
      )}

      {plan && pending && !generating && (
        <>
          {plan.suggestions.length === 0 ? (
            <Text style={typography.caption}>{t('aiPlan.noNew')}</Text>
          ) : (
            <Text style={typography.caption}>
              {swapsLeft > 0
                ? t(swapsLeft === 1 ? 'aiPlan.chooseSwapOne' : 'aiPlan.chooseSwapMany', {
                    count: swapsLeft,
                  })
                : t('aiPlan.choose')}
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
                ? t('aiPlan.ok')
                : selected.size === 0
                  ? t('aiPlan.selectOne')
                  : t(selected.size === 1 ? 'aiPlan.addOne' : 'aiPlan.addMany', {
                      count: selected.size,
                    })
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
              title={t('aiPlan.reject')}
              onPress={() => confirmReject(plan)}
              variant="secondary"
              disabled={busy !== null}
            />
          )}
        </>
      )}

      {!pending && !generating && (
        <View style={styles.actions}>
          <Text style={typography.label}>{t('aiPlan.tellUs')}</Text>
          <Text style={typography.caption}>{t('aiPlan.tellUsHint')}</Text>
          <Field
            label={t('aiPlan.goalLabel')}
            value={goal}
            onChangeText={setGoal}
            placeholder={t('aiPlan.goalPlaceholder')}
            maxLength={PLAN_GOAL_MAX}
            multiline
          />
          <Text style={typography.label}>{t('aiPlan.timePerDay')}</Text>
          <Chips options={minuteOptions} selected={[minutes]} onToggle={setMinutes} />
          <Text style={typography.label}>{t('aiPlan.freeDays')}</Text>
          <Chips
            multiple
            options={dayOptions(locale)}
            selected={freeDays}
            onToggle={(d) => setFreeDays((cur) => toggleScheduleDay(cur, d))}
          />
          <Field
            label={t('aiPlan.pastLabel')}
            value={past}
            onChangeText={setPast}
            placeholder={t('aiPlan.pastPlaceholder')}
            maxLength={PLAN_PAST_MAX}
            multiline
          />

          <Text style={[typography.label, styles.spaced]}>{t('aiPlan.consult')}</Text>
          <Button
            title={t('aiPlan.reveal')}
            onPress={() => generate('initial')}
            disabled={busy !== null}
          />
          <Text style={typography.caption}>{t('aiPlan.revealHint')}</Text>
          <Button
            title={t('aiPlan.review')}
            onPress={() => generate('weekly')}
            variant="secondary"
            disabled={busy !== null}
          />
          <Text style={typography.caption}>{t('aiPlan.reviewHint')}</Text>
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
  const { t, locale } = useT();
  const DIFFICULTY_LABEL = DIFFICULTY_LABELS[locale];
  const s = suggestion;
  const title = draft?.title ?? s.title;
  const difficulty = draft?.difficulty ?? s.difficulty;
  const days = draft?.scheduleDays ?? s.scheduleDays;
  const meta = `${DIFFICULTY_LABEL[difficulty]} · ${describeSchedule(days, locale)}`;
  const objective = s.objectiveTitle
    ? `${s.objectiveTitle} (${OBJECTIVE_CATEGORY_LABELS[locale][s.objectiveCategory]})`
    : null;
  const crystals = estimateMissionCrystals(difficulty, s.objectiveCategory, heroClass);
  const reward = t('aiPlan.reward', {
    xp: xpForHabit(difficulty),
    crystals,
    attribute: attributeLabel(s.objectiveCategory, locale),
  });

  return (
    <View style={[styles.row, checked && styles.rowChecked]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${title}, ${meta}. ${reward}${objective ? `, ${t('aiPlan.objectiveA11y', { objective })}` : ''}`}
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
            {draft ? <Text style={styles.edited}> · {t('aiPlan.edited')}</Text> : null}
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
          accessibilityLabel={t('aiPlan.editA11y', { title })}
          style={styles.smallButton}
        >
          <Ionicons
            name={editing ? 'chevron-up' : 'create-outline'}
            size={15}
            color={colors.text}
          />
          <Text style={styles.smallText}>{editing ? t('aiPlan.close') : t('aiPlan.edit')}</Text>
        </Pressable>
        <Pressable
          onPress={onSwap}
          disabled={!canSwap}
          accessibilityRole="button"
          accessibilityLabel={t('aiPlan.swapA11y', { title })}
          style={[styles.smallButton, !canSwap && styles.disabled]}
        >
          {swapping ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Ionicons name="refresh" size={15} color={colors.text} />
          )}
          <Text style={styles.smallText}>{t('aiPlan.swap')}</Text>
        </Pressable>
      </View>

      {editing && draft && (
        <View style={styles.editor}>
          <Field
            label={t('aiPlan.name')}
            value={draft.title}
            onChangeText={(text) => onChange({ ...draft, title: text })}
            maxLength={120}
          />
          <Text style={typography.label}>{t('aiPlan.difficulty')}</Text>
          <Chips
            options={difficultyOptions(locale)}
            selected={[draft.difficulty]}
            onToggle={(d) => onChange({ ...draft, difficulty: d })}
          />
          <Text style={typography.label}>{t('aiPlan.days')}</Text>
          <Chips
            multiple
            options={dayOptions(locale)}
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

export default function AiPlanScreenRoute() {
  return (
    <FeatureGate feature={FEATURES.oracle}>
      <AiPlanScreen />
    </FeatureGate>
  );
}
