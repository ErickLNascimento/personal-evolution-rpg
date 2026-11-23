import { Ionicons } from '@expo/vector-icons';
import {
  canDecide,
  describeSchedule,
  DIFFICULTY_LABEL,
  hasAiConsent,
  OBJECTIVE_CATEGORY_LABEL,
  type AiHabitSuggestion,
  type AiPlanKind,
} from '@per/domain';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import { decidePlan, latestPlan, requestPlan, type AiPlan } from '@/features/ai/api';
import { useProfile } from '@/features/profile/useProfile';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const KIND_LABEL: Record<AiPlanKind, string> = { initial: 'Plano inicial', weekly: 'Revisão semanal' };

export default function AiPlanScreen() {
  const { profile, loading: profileLoading } = useProfile();
  const [plan, setPlan] = useState<AiPlan | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<'initial' | 'weekly' | 'decide' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      latestPlan().then((r) => {
        if (!active) return;
        setError(r.error);
        setPlan(r.data);
        if (r.data) setSelected(new Set(r.data.suggestions.map((s) => s.index)));
      });
      return () => {
        active = false;
      };
    }, []),
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
          Para receber sugestões, ative “Permitir que a IA use meus dados” no Perfil. Seus objetivos, hábitos e registros
          (sem nome nem e-mail) vão para os provedores de IA (Google Gemini e, como reserva, Groq). A IA só propõe: nada
          muda sem a sua aprovação, e ela nunca altera seu XP.
        </Text>
        <Button title="Ir para o Perfil" onPress={() => router.navigate('/profile')} />
      </StackScreen>
    );
  }

  async function generate(kind: AiPlanKind) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    const r = await requestPlan(kind);
    setBusy(null);
    if (r.error !== null) {
      setError(r.error);
      return;
    }
    setPlan(r.data);
    setSelected(new Set(r.data.suggestions.map((s) => s.index)));
  }

  async function decide(current: AiPlan, accept: boolean) {
    setBusy('decide');
    setError(null);
    const r = await decidePlan(current.id, accept, accept ? [...selected] : []);
    setBusy(null);
    if (r.error !== null) {
      setError(r.error);
      return;
    }
    setPlan({ ...current, status: accept ? 'accepted' : 'rejected' });
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

  return (
    <StackScreen>
      <FormMessage text={notice} tone="info" />
      <FormMessage text={error} />

      {generating && (
        <View style={styles.thinking} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={typography.body}>A IA está analisando seus dados. Isso pode levar até um minuto.</Text>
        </View>
      )}

      {plan && !generating && (
        <View style={styles.card}>
          <Text style={typography.label}>
            {KIND_LABEL[plan.kind].toUpperCase()} · {new Date(plan.createdAt).toLocaleDateString('pt-BR')}
          </Text>
          {plan.summary ? <Text style={typography.body}>{plan.summary}</Text> : null}
          {!pending && (
            <Text style={typography.caption}>{plan.status === 'accepted' ? 'Você aceitou este plano.' : 'Você recusou este plano.'}</Text>
          )}
        </View>
      )}

      {plan && pending && !generating && (
        <>
          {plan.suggestions.length === 0 ? (
            <Text style={typography.caption}>Sem hábitos novos desta vez: continue com a rotina atual.</Text>
          ) : (
            <Text style={typography.caption}>Escolha o que quer adicionar. Os hábitos começam hoje.</Text>
          )}
          {plan.suggestions.map((s) => (
            <SuggestionRow
              key={s.index}
              suggestion={s}
              checked={selected.has(s.index)}
              onToggle={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.index)) next.delete(s.index);
                  else next.add(s.index);
                  return next;
                })
              }
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
            disabled={plan.suggestions.length > 0 && selected.size === 0}
          />
          {plan.suggestions.length > 0 && (
            <Button title="Recusar" onPress={() => confirmReject(plan)} variant="secondary" disabled={busy !== null} />
          )}
        </>
      )}

      {!pending && !generating && (
        <View style={styles.actions}>
          <Text style={typography.label}>PEDIR À IA</Text>
          <Button title="Plano inicial" onPress={() => generate('initial')} disabled={busy !== null} />
          <Text style={typography.caption}>Sugere de 2 a 5 hábitos para começar, a partir dos seus objetivos.</Text>
          <Button title="Revisão da semana" onPress={() => generate('weekly')} variant="secondary" disabled={busy !== null} />
          <Text style={typography.caption}>Analisa os últimos 14 dias e sugere ajustes.</Text>
        </View>
      )}
    </StackScreen>
  );
}

function SuggestionRow({
  suggestion,
  checked,
  onToggle,
}: {
  suggestion: AiHabitSuggestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const s = suggestion;
  const meta = `${DIFFICULTY_LABEL[s.difficulty]} · ${describeSchedule(s.scheduleDays)}`;
  const objective = s.objectiveTitle ? `${s.objectiveTitle} (${OBJECTIVE_CATEGORY_LABEL[s.objectiveCategory]})` : null;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${s.title}, ${meta}${objective ? `, objetivo ${objective}` : ''}`}
      style={({ pressed }) => [styles.row, checked && styles.rowChecked, pressed && styles.pressed]}
    >
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={26} color={checked ? colors.primary : colors.textSecondary} />
      <View style={styles.body}>
        <Text style={typography.body}>{s.title}</Text>
        <Text style={typography.caption}>{meta}</Text>
        {objective ? <Text style={styles.objective}>◆ {objective}</Text> : null}
        {s.rationale ? <Text style={typography.caption}>{s.rationale}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowChecked: { borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  objective: { ...typography.caption, color: colors.primary },
});
