import { Ionicons } from '@expo/vector-icons';
import {
  defaultTemplateSelection,
  describeSchedule,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  FOCUS_AREAS_MAX,
  normalizeDisplayName,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABEL,
  onboardingHabits,
  ONBOARDING_STEPS,
  resolveTimeZone,
  templatesFor,
  toggleFocusArea,
  validateFocusAreas,
  heroLook,
  NO_PATH,
  RACES,
  RACE_INFO,
  suggestPath,
  type Difficulty,
  type ObjectiveCategory,
  type PathId,
  type Race,
} from '@per/domain';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { PathPicker } from '@/components/hero/PathPicker';
import { choosePath } from '@/features/hero/pathApi';
import { useProfile } from '@/features/profile/ProfileProvider';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: 'Começar leve: missões curtas para criar constância.',
  medium: 'Equilíbrio entre esforço e rotina.',
  hard: 'Desafio: missões que exigem disciplina.',
};

/** Ordem dos passos do primeiro acesso. */
const STEP = { name: 0, race: 1, areas: 2, path: 3, rhythm: 4, missions: 5 } as const;

const AREA_OPTIONS = OBJECTIVE_CATEGORIES.map((c) => ({
  value: c,
  label: OBJECTIVE_CATEGORY_LABEL[c],
}));

export default function OnboardingScreen() {
  const { profile, completeOnboarding, update } = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [areas, setAreas] = useState<ObjectiveCategory[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [templates, setTemplates] = useState<string[]>([]);
  const [race, setRace] = useState<Race>(profile?.race ?? 'humano');
  const [path, setPath] = useState<PathId | null>(profile?.heroPath.path ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fuso do aparelho; o perfil pode ter vindo do cadastro com outro valor.
  const timeZone = resolveTimeZone(deviceTimeZone() ?? profile?.timezone);

  function next() {
    setError(null);
    if (step === STEP.name) {
      const r = normalizeDisplayName(name);
      if (r.error) return setError(r.error);
    }
    if (step === STEP.areas) {
      const invalid = validateFocusAreas(areas);
      if (invalid) return setError(invalid);
      // Sugere o caminho da primeira área e pré-seleciona o primeiro modelo de cada área.
      if (!path) setPath(suggestPath(areas));
      setTemplates(defaultTemplateSelection(areas));
    }
    if (step === STEP.path && !path) return setError('Escolha um caminho para o seu herói.');
    setStep((s) => s + 1);
  }

  async function finish(skip: boolean) {
    setError(null);
    setSaving(true);
    const displayName = normalizeDisplayName(name).value ?? '';
    // Raça e caminho antes de concluir: ao concluir, o app já vai para as abas.
    const raceErr = race !== profile?.race ? await update({ race }) : null;
    const chosen = await choosePath(path ?? suggestPath(areas));
    if (raceErr || chosen.error !== null) {
      setSaving(false);
      setError(raceErr ?? chosen.error);
      return;
    }
    const err = await completeOnboarding({
      displayName,
      focusAreas: skip && validateFocusAreas(areas) ? [] : areas,
      difficulty,
      timezone: timeZone,
      habits: skip ? [] : onboardingHabits(areas, templates),
    });
    setSaving(false);
    // Com sucesso, o perfil muda e o _layout leva para as abas.
    if (err) setError(err);
  }

  const options = templatesFor(areas);
  const isLast = step === ONBOARDING_STEPS - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View
            style={styles.progress}
            accessible
            accessibilityLabel={`Passo ${step + 1} de ${ONBOARDING_STEPS}`}
          >
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
            ))}
          </View>

          {step === 0 && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                Bem-vindo à sua jornada
              </Text>
              <Text style={typography.body}>
                Cada hábito vira uma missão diária. Concluir missões dá XP, sobe seu nível e mantém
                o streak.
              </Text>
              <Field
                label="Como quer ser chamado"
                value={name}
                onChangeText={setName}
                placeholder="Opcional"
                maxLength={60}
              />
            </>
          )}

          {step === STEP.race && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                Quem é o seu herói?
              </Text>
              <Text style={typography.body}>
                A raça muda só a aparência. Dá para trocar quando quiser.
              </Text>
              <View style={styles.preview}>
                <HeroAvatar hero={heroLook({}, 1, NO_PATH, race)} size={110} animated />
              </View>
              <Chips
                options={RACES.map((r) => ({ value: r, label: RACE_INFO[r].label.masculino }))}
                selected={[race]}
                onToggle={setRace}
              />
              <Text style={typography.caption}>{RACE_INFO[race].description}</Text>
            </>
          )}

          {step === STEP.areas && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                Onde quer evoluir?
              </Text>
              <Text style={typography.body}>
                Escolha até {FOCUS_AREAS_MAX} áreas para começar. Dá para mudar depois.
              </Text>
              <Chips
                multiple
                options={AREA_OPTIONS}
                selected={areas}
                onToggle={(a) => setAreas((cur) => toggleFocusArea(cur, a))}
              />
              <Text style={typography.caption}>
                {areas.length}/{FOCUS_AREAS_MAX} escolhidas
              </Text>
            </>
          )}

          {step === STEP.path && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                Escolha seu caminho
              </Text>
              <Text style={typography.body}>
                O caminho define como seu herói evolui. As missões da área dele contam para as
                promoções: de Aventureiro a Cavaleiro, de Aprendiz a Arquimago…
              </Text>
              <PathPicker
                look={heroLook({}, 1, NO_PATH, race)}
                value={path}
                onChoose={setPath}
                suggested={areas.length ? suggestPath(areas) : undefined}
              />
            </>
          )}

          {step === STEP.rhythm && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                Qual ritmo prefere?
              </Text>
              {DIFFICULTIES.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: difficulty === d }}
                  accessibilityLabel={`${DIFFICULTY_LABEL[d]}. ${DIFFICULTY_HINT[d]}`}
                  style={({ pressed }) => [
                    styles.option,
                    difficulty === d && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={difficulty === d ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={difficulty === d ? colors.primary : colors.textSecondary}
                  />
                  <View style={styles.body}>
                    <Text style={typography.body}>{DIFFICULTY_LABEL[d]}</Text>
                    <Text style={typography.caption}>{DIFFICULTY_HINT[d]}</Text>
                  </View>
                </Pressable>
              ))}
              <Text style={typography.caption}>
                Seu fuso horário: {timeZone}. Ele define quando o seu dia começa; dá para mudar no
                Perfil.
              </Text>
            </>
          )}

          {step === STEP.missions && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                Suas primeiras missões
              </Text>
              <Text style={typography.body}>
                Marque os hábitos que quer começar hoje. Você pode editar ou criar outros depois.
              </Text>
              {options.map((t) => {
                const checked = templates.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() =>
                      setTemplates((cur) =>
                        checked ? cur.filter((id) => id !== t.id) : [...cur, t.id],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${t.title}, ${DIFFICULTY_LABEL[t.difficulty]}, ${describeSchedule(t.scheduleDays)}`}
                    style={({ pressed }) => [
                      styles.option,
                      checked && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={checked ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.body}>
                      <Text style={typography.body}>{t.title}</Text>
                      <Text style={typography.caption}>
                        {DIFFICULTY_LABEL[t.difficulty]} · {describeSchedule(t.scheduleDays)} ·{' '}
                        {OBJECTIVE_CATEGORY_LABEL[t.category]}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}

          <FormMessage text={error} />

          <View style={styles.actions}>
            {isLast ? (
              <Button
                title={
                  templates.length === 0
                    ? 'Começar sem hábitos'
                    : `Começar com ${templates.length} ${templates.length === 1 ? 'hábito' : 'hábitos'}`
                }
                onPress={() => finish(false)}
                loading={saving}
              />
            ) : (
              <Button title="Continuar" onPress={next} />
            )}
            {step > 0 && (
              <Button
                title="Voltar"
                onPress={() => setStep((s) => s - 1)}
                variant="secondary"
                disabled={saving}
              />
            )}
            {!isLast && (
              <Pressable
                onPress={() => finish(true)}
                accessibilityRole="button"
                style={styles.skip}
                disabled={saving}
              >
                <Text style={typography.caption}>Pular por enquanto</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dot: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  dotActive: { backgroundColor: colors.primary },
  preview: { alignItems: 'center' },
  option: {
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  actions: { gap: spacing.sm, marginTop: 'auto', paddingTop: spacing.md },
  skip: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
