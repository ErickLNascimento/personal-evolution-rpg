import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FOCUS_AREAS_MAX,
  hasAiConsent,
  isValidTimeZone,
  normalizeDisplayName,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABELS,
  toggleFocusArea,
  validateFocusAreas,
  FEATURES,
  type Difficulty,
  type ObjectiveCategory,
} from '@per/domain';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { Placeholder, Screen } from '@/components/Screen';
import { AppTour } from '@/components/tour/AppTour';
import { latestNewsSlides } from '@/lib/whatsNew';
import { useAuth } from '@/features/auth/AuthProvider';
import { useHero } from '@/features/hero/useHero';
import { exportMyData } from '@/features/account/exportData';
import { useFeature } from '@/features/profile/useFeature';
import { useProfile } from '@/features/profile/useProfile';
import { useToday } from '@/features/profile/useToday';
import { useT } from '@/i18n';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { ensureReminderPermission, syncReminders } from '@/lib/reminders';
import { setSmartNotificationsEnabled, smartNotificationsEnabled } from '@/lib/smartNotifications';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function ProfileScreen() {
  const { t } = useT();
  const { isDemo } = useAuth();
  if (isDemo) {
    return (
      <Screen title={t('profile.title')}>
        <Placeholder text={t('profile.demo')} />
      </Screen>
    );
  }
  return <AccountProfile />;
}

function AccountProfile() {
  const { t, locale } = useT();
  const { session } = useAuth();
  const { profile, loading, error, reload, update } = useProfile();
  const smartOn = useFeature(FEATURES.smartNotifications);
  const exportOn = useFeature(FEATURES.dataExport);
  const englishOn = useFeature(FEATURES.english);
  const { hero } = useHero();
  const [tourOpen, setTourOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);

  if (loading && !profile) {
    return (
      <Screen title="Perfil">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen title={t('profile.title')}>
        <FormMessage text={error ?? t('profile.notFound')} />
        <Button title={t('common.retry')} onPress={reload} variant="secondary" />
        <SignOutButton />
      </Screen>
    );
  }

  return (
    <Screen title={t('profile.title')}>
      <Section title={t('profile.account')}>
        <Text style={typography.caption}>{t('profile.signedInAs')}</Text>
        <Text style={typography.body}>{session?.user.email}</Text>
        <DisplayNameForm
          initial={profile.displayName}
          onSave={(v) => update({ display_name: v })}
        />
      </Section>

      <Section title={t('profile.focus')}>
        <FocusForm
          key={`${profile.focusAreas.join()}|${profile.difficulty}`}
          areas={profile.focusAreas}
          difficulty={profile.difficulty}
          onSave={(focus_areas, difficulty) => update({ focus_areas, difficulty })}
        />
      </Section>

      <Section title={t('profile.timezone')}>
        <TimeZoneForm
          key={profile.timezone}
          current={profile.timezone}
          onSave={(tz) => update({ timezone: tz })}
        />
      </Section>

      <Section title={t('profile.oracle')}>
        <AiConsent
          consentAt={profile.aiConsentAt}
          onChange={(on) => update({ ai_consent_at: on ? new Date().toISOString() : null })}
        />
      </Section>

      {englishOn && <LanguagePicker />}

      {smartOn && (
        <Section title={t('profile.notifications')}>
          <SmartNotificationsToggle />
        </Section>
      )}

      <Section title={t('profile.help')}>
        <Button title={t('profile.sendFeedback')} onPress={() => router.push('/feedback')} />
        <Button
          title={t('profile.seeTour')}
          onPress={() => setTourOpen(true)}
          variant="secondary"
        />
        <Button title={t('profile.news')} onPress={() => setNewsOpen(true)} variant="secondary" />
      </Section>
      <AppTour visible={tourOpen} hero={hero} onClose={() => setTourOpen(false)} />
      <AppTour
        visible={newsOpen}
        hero={hero}
        slides={latestNewsSlides(profile?.features, locale)}
        heading={t('today.news')}
        finishLabel={t('today.gotIt')}
        onClose={() => setNewsOpen(false)}
      />

      {exportOn && profile && (
        <Section title={t('profile.yourData')}>
          <DataExport userId={profile.id} />
        </Section>
      )}

      <SignOutButton />
      <Button
        title={t('profile.deleteAccount')}
        onPress={() => router.push('/delete-account')}
        variant="secondary"
      />
    </Screen>
  );
}

/** Idioma do app: seguir o celular ou fixar português/inglês (só com a flag feature_english). */
function LanguagePicker() {
  const { t, preference, setPreference } = useT();
  const options = [
    { value: 'auto' as const, label: t('language.auto') },
    { value: 'pt-BR' as const, label: t('language.pt') },
    { value: 'en' as const, label: t('language.en') },
  ];
  return (
    <Section title={t('language.title')}>
      <Chips options={options} selected={[preference]} onToggle={setPreference} />
      <Text style={typography.caption}>{t('language.hint')}</Text>
    </Section>
  );
}

/** Baixar um arquivo com todos os dados pessoais (LGPD). */
function DataExport({ userId }: { userId: string }) {
  const { t } = useT();
  const { today } = useToday();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Text style={typography.caption}>{t('profile.exportText')}</Text>
      <FormMessage text={error} />
      <Button
        title={t('profile.exportButton')}
        variant="secondary"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          setError(await exportMyData(userId, today));
          setBusy(false);
        }}
      />
    </>
  );
}

function FocusForm({
  areas: initialAreas,
  difficulty: initialDifficulty,
  onSave,
}: {
  areas: ObjectiveCategory[];
  difficulty: Difficulty;
  onSave: (areas: ObjectiveCategory[], difficulty: Difficulty) => Promise<string | null>;
}) {
  const { t, locale } = useT();
  const [areas, setAreas] = useState(initialAreas);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const dirty = areas.join() !== initialAreas.join() || difficulty !== initialDifficulty;

  async function save() {
    const invalid = validateFocusAreas(areas, locale);
    if (invalid) {
      setMessage({ text: invalid, tone: 'error' });
      return;
    }
    setSaving(true);
    const err = await onSave(areas, difficulty);
    setSaving(false);
    setMessage(
      err ? { text: err, tone: 'error' } : { text: t('profile.prefsSaved'), tone: 'info' },
    );
  }

  return (
    <>
      <Text style={typography.caption}>{t('profile.focusHint', { max: FOCUS_AREAS_MAX })}</Text>
      <Chips
        multiple
        options={OBJECTIVE_CATEGORIES.map((c) => ({
          value: c,
          label: OBJECTIVE_CATEGORY_LABELS[locale][c],
        }))}
        selected={areas}
        onToggle={(a) => setAreas((cur) => toggleFocusArea(cur, a))}
      />
      <Text style={typography.label}>{t('profile.pace')}</Text>
      <Chips
        options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[locale][d] }))}
        selected={[difficulty]}
        onToggle={setDifficulty}
      />
      <FormMessage text={message?.text ?? null} tone={message?.tone} />
      {dirty && <Button title={t('profile.savePrefs')} onPress={save} loading={saving} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={typography.label} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function DisplayNameForm({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (value: string | null) => Promise<string | null>;
}) {
  const { t, locale } = useT();
  const [value, setValue] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const dirty = value.trim() !== (initial ?? '');

  async function save() {
    const { value: name, error } = normalizeDisplayName(value, locale);
    if (error) {
      setMessage({ text: error, tone: 'error' });
      return;
    }
    setSaving(true);
    const saveError = await onSave(name);
    setSaving(false);
    setMessage(
      saveError
        ? { text: saveError, tone: 'error' }
        : { text: t('profile.nameSaved'), tone: 'info' },
    );
  }

  return (
    <>
      <Field
        label={t('profile.displayName')}
        value={value}
        onChangeText={setValue}
        placeholder={t('profile.displayNamePlaceholder')}
        maxLength={60}
      />
      <FormMessage text={message?.text ?? null} tone={message?.tone} />
      {dirty && <Button title={t('profile.saveName')} onPress={save} loading={saving} />}
    </>
  );
}

function TimeZoneForm({
  current,
  onSave,
}: {
  current: string;
  onSave: (tz: string) => Promise<string | null>;
}) {
  const { t } = useT();
  const device = deviceTimeZone();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  async function save(tz: string) {
    const trimmed = tz.trim();
    if (!isValidTimeZone(trimmed)) {
      setMessage({
        text: t('profile.tzInvalid'),
        tone: 'error',
      });
      return;
    }
    setSaving(true);
    const saveError = await onSave(trimmed);
    setSaving(false);
    setMessage(
      saveError ? { text: saveError, tone: 'error' } : { text: t('profile.tzSaved'), tone: 'info' },
    );
  }

  return (
    <>
      <Text style={typography.caption}>{t('profile.tzHint')}</Text>
      {device && device !== current && (
        <View style={styles.notice}>
          <Text style={typography.body}>{t('profile.tzDevice', { tz: device })}</Text>
          <Button
            title={t('profile.tzUse', { tz: device })}
            onPress={() => save(device)}
            loading={saving}
          />
        </View>
      )}
      <Field
        label={t('profile.tzField')}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="America/Sao_Paulo"
      />
      <FormMessage text={message?.text ?? null} tone={message?.tone} />
      {value.trim() !== current && (
        <Button title={t('profile.tzSave')} onPress={() => save(value)} loading={saving} />
      )}
    </>
  );
}

function AiConsent({
  consentAt,
  onChange,
}: {
  consentAt: string | null;
  onChange: (on: boolean) => Promise<string | null>;
}) {
  const { t, locale } = useT();
  const enabled = hasAiConsent({ aiConsentAt: consentAt });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(on: boolean) {
    setSaving(true);
    setError(await onChange(on));
    setSaving(false);
  }

  function confirmToggle(on: boolean) {
    if (on) {
      void toggle(true);
      return;
    }
    Alert.alert(t('profile.aiOffTitle'), t('profile.aiOffText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.aiOff'), style: 'destructive', onPress: () => void toggle(false) },
    ]);
  }

  return (
    <>
      <View style={styles.switchRow}>
        <Text style={[typography.body, styles.switchLabel]}>{t('profile.aiAllow')}</Text>
        <Switch
          value={enabled}
          onValueChange={confirmToggle}
          disabled={saving}
          accessibilityLabel={t('profile.aiAllow')}
          trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
        />
      </View>
      <Text style={typography.caption}>{t('profile.aiHint')}</Text>
      {enabled && consentAt && (
        <Text style={typography.caption}>
          {t('profile.aiSince', { date: new Date(consentAt).toLocaleDateString(locale) })}
        </Text>
      )}
      <FormMessage text={error} />
    </>
  );
}

/** Liga/desliga os avisos de streak, missão relâmpago e promoção (os lembretes de hábito seguem). */
function SmartNotificationsToggle() {
  const { t } = useT();
  const [on, setOn] = useState(() => smartNotificationsEnabled());
  async function toggle(next: boolean) {
    setOn(next);
    setSmartNotificationsEnabled(next);
    if (next) await ensureReminderPermission();
    void syncReminders().catch(() => undefined);
  }
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={typography.body}>{t('profile.heroAlerts')}</Text>
        <Text style={typography.caption}>{t('profile.heroAlertsHint')}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={(v) => void toggle(v)}
        accessibilityLabel={t('profile.heroAlerts')}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

function SignOutButton() {
  const { t } = useT();
  const [loading, setLoading] = useState(false);

  function confirmSignOut() {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          // Sai mesmo sem internet: a sessão local é apagada e o _layout volta para o login.
          await supabase?.auth.signOut({ scope: 'local' });
          setLoading(false);
        },
      },
    ]);
  }

  return (
    <Button
      title={t('profile.signOut')}
      onPress={confirmSignOut}
      variant="danger"
      loading={loading}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notice: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { flex: 1 },
});
