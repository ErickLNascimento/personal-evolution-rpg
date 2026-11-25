import { Ionicons } from '@expo/vector-icons';
import {
  defaultTemplateSelection,
  describeSchedule,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FOCUS_AREAS_MAX,
  normalizeDisplayName,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABELS,
  onboardingHabits,
  ONBOARDING_STEPS,
  resolveTimeZone,
  templatesFor,
  toggleFocusArea,
  validateFocusAreas,
  heroLook,
  NO_PATH,
  RACES,
  raceDescription,
  raceLabel,
  suggestPath,
  type Difficulty,
  type Locale,
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
import { useT, type TKey } from '@/i18n';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const DIFFICULTY_HINT: Record<Difficulty, TKey> = {
  easy: 'onboarding.hintEasy',
  medium: 'onboarding.hintMedium',
  hard: 'onboarding.hintHard',
};

/** Ordem dos passos do primeiro acesso. */
const STEP = { name: 0, race: 1, areas: 2, path: 3, rhythm: 4, missions: 5 } as const;

const areaOptions = (locale: Locale) =>
  OBJECTIVE_CATEGORIES.map((c) => ({ value: c, label: OBJECTIVE_CATEGORY_LABELS[locale][c] }));

export default function OnboardingScreen() {
  const { profile, completeOnboarding, update } = useProfile();
  const { t, locale } = useT();
  const DIFFICULTY_LABEL = DIFFICULTY_LABELS[locale];
  const OBJECTIVE_CATEGORY_LABEL = OBJECTIVE_CATEGORY_LABELS[locale];
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
      const r = normalizeDisplayName(name, locale);
      if (r.error) return setError(r.error);
    }
    if (step === STEP.areas) {
      const invalid = validateFocusAreas(areas, locale);
      if (invalid) return setError(invalid);
      // Sugere o caminho da primeira área e pré-seleciona o primeiro modelo de cada área.
      if (!path) setPath(suggestPath(areas));
      setTemplates(defaultTemplateSelection(areas));
    }
    if (step === STEP.path && !path) return setError(t('onboarding.pathRequired'));
    setStep((s) => s + 1);
  }

  async function finish(skip: boolean) {
    setError(null);
    setSaving(true);
    const displayName = normalizeDisplayName(name, locale).value ?? '';
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
      habits: skip ? [] : onboardingHabits(areas, templates, locale),
    });
    setSaving(false);
    // Com sucesso, o perfil muda e o _layout leva para as abas.
    if (err) setError(err);
  }

  const options = templatesFor(areas, locale);
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
            accessibilityLabel={t('onboarding.step', { step: step + 1, total: ONBOARDING_STEPS })}
          >
            {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
            ))}
          </View>

          {step === 0 && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                {t('onboarding.welcome')}
              </Text>
              <Text style={typography.body}>{t('onboarding.welcomeBody')}</Text>
              <Field
                label={t('onboarding.nameLabel')}
                value={name}
                onChangeText={setName}
                placeholder={t('onboarding.optional')}
                maxLength={60}
              />
            </>
          )}

          {step === STEP.race && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                {t('onboarding.raceTitle')}
              </Text>
              <Text style={typography.body}>{t('onboarding.raceBody')}</Text>
              <View style={styles.preview}>
                <HeroAvatar hero={heroLook({}, 1, NO_PATH, race)} size={110} animated />
              </View>
              <Chips
                options={RACES.map((r) => ({ value: r, label: raceLabel(r, 'masculino', locale) }))}
                selected={[race]}
                onToggle={setRace}
              />
              <Text style={typography.caption}>{raceDescription(race, locale)}</Text>
            </>
          )}

          {step === STEP.areas && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                {t('onboarding.areasTitle')}
              </Text>
              <Text style={typography.body}>
                {t('onboarding.areasBody', { max: FOCUS_AREAS_MAX })}
              </Text>
              <Chips
                multiple
                options={areaOptions(locale)}
                selected={areas}
                onToggle={(a) => setAreas((cur) => toggleFocusArea(cur, a))}
              />
              <Text style={typography.caption}>
                {t('onboarding.areasCount', { count: areas.length, max: FOCUS_AREAS_MAX })}
              </Text>
            </>
          )}

          {step === STEP.path && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                {t('onboarding.pathTitle')}
              </Text>
              <Text style={typography.body}>{t('onboarding.pathBody')}</Text>
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
                {t('onboarding.rhythmTitle')}
              </Text>
              {DIFFICULTIES.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDifficulty(d)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: difficulty === d }}
                  accessibilityLabel={`${DIFFICULTY_LABEL[d]}. ${t(DIFFICULTY_HINT[d])}`}
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
                    <Text style={typography.caption}>{t(DIFFICULTY_HINT[d])}</Text>
                  </View>
                </Pressable>
              ))}
              <Text style={typography.caption}>
                {t('onboarding.timeZone', { zone: timeZone })}
              </Text>
            </>
          )}

          {step === STEP.missions && (
            <>
              <Text style={typography.title} accessibilityRole="header">
                {t('onboarding.missionsTitle')}
              </Text>
              <Text style={typography.body}>{t('onboarding.missionsBody')}</Text>
              {options.map((tpl) => {
                const checked = templates.includes(tpl.id);
                return (
                  <Pressable
                    key={tpl.id}
                    onPress={() =>
                      setTemplates((cur) =>
                        checked ? cur.filter((id) => id !== tpl.id) : [...cur, tpl.id],
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={`${tpl.title}, ${DIFFICULTY_LABEL[tpl.difficulty]}, ${describeSchedule(tpl.scheduleDays, locale)}`}
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
                      <Text style={typography.body}>{tpl.title}</Text>
                      <Text style={typography.caption}>
                        {DIFFICULTY_LABEL[tpl.difficulty]} · {describeSchedule(tpl.scheduleDays, locale)} ·{' '}
                        {OBJECTIVE_CATEGORY_LABEL[tpl.category]}
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
                    ? t('onboarding.startNone')
                    : t(templates.length === 1 ? 'onboarding.startOne' : 'onboarding.startMany', {
                        count: templates.length,
                      })
                }
                onPress={() => finish(false)}
                loading={saving}
              />
            ) : (
              <Button title={t('onboarding.continue')} onPress={next} />
            )}
            {step > 0 && (
              <Button
                title={t('onboarding.back')}
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
                <Text style={typography.caption}>{t('onboarding.skip')}</Text>
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
