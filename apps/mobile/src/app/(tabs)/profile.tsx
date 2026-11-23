import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  FOCUS_AREAS_MAX,
  hasAiConsent,
  isValidTimeZone,
  normalizeDisplayName,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABEL,
  toggleFocusArea,
  validateFocusAreas,
  type Difficulty,
  type ObjectiveCategory,
} from '@per/domain';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { Placeholder, Screen } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/useProfile';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export default function ProfileScreen() {
  const { isDemo } = useAuth();
  if (isDemo) {
    return (
      <Screen title="Perfil">
        <Placeholder text="Modo demonstração: configure o Supabase no .env.local para criar sua conta." />
      </Screen>
    );
  }
  return <AccountProfile />;
}

function AccountProfile() {
  const { session } = useAuth();
  const { profile, loading, error, reload, update } = useProfile();

  if (loading && !profile) {
    return (
      <Screen title="Perfil">
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen title="Perfil">
        <FormMessage text={error ?? 'Perfil não encontrado.'} />
        <Button title="Tentar de novo" onPress={reload} variant="secondary" />
        <SignOutButton />
      </Screen>
    );
  }

  return (
    <Screen title="Perfil">
      <Section title="CONTA">
        <Text style={typography.caption}>Conectado como</Text>
        <Text style={typography.body}>{session?.user.email}</Text>
        <DisplayNameForm initial={profile.displayName} onSave={(v) => update({ display_name: v })} />
      </Section>

      <Section title="FOCO E RITMO">
        <FocusForm
          key={`${profile.focusAreas.join()}|${profile.difficulty}`}
          areas={profile.focusAreas}
          difficulty={profile.difficulty}
          onSave={(focus_areas, difficulty) => update({ focus_areas, difficulty })}
        />
      </Section>

      <Section title="FUSO HORÁRIO">
        <TimeZoneForm key={profile.timezone} current={profile.timezone} onSave={(tz) => update({ timezone: tz })} />
      </Section>

      <Section title="ORÁCULO (INTELIGÊNCIA ARTIFICIAL)">
        <AiConsent
          consentAt={profile.aiConsentAt}
          onChange={(on) => update({ ai_consent_at: on ? new Date().toISOString() : null })}
        />
      </Section>

      <SignOutButton />
      <Button title="Excluir minha conta" onPress={() => router.push('/delete-account')} variant="secondary" />
    </Screen>
  );
}

const AREA_OPTIONS = OBJECTIVE_CATEGORIES.map((c) => ({ value: c, label: OBJECTIVE_CATEGORY_LABEL[c] }));
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }));

function FocusForm({
  areas: initialAreas,
  difficulty: initialDifficulty,
  onSave,
}: {
  areas: ObjectiveCategory[];
  difficulty: Difficulty;
  onSave: (areas: ObjectiveCategory[], difficulty: Difficulty) => Promise<string | null>;
}) {
  const [areas, setAreas] = useState(initialAreas);
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const dirty = areas.join() !== initialAreas.join() || difficulty !== initialDifficulty;

  async function save() {
    const invalid = validateFocusAreas(areas);
    if (invalid) {
      setMessage({ text: invalid, tone: 'error' });
      return;
    }
    setSaving(true);
    const err = await onSave(areas, difficulty);
    setSaving(false);
    setMessage(err ? { text: err, tone: 'error' } : { text: 'Preferências salvas.', tone: 'info' });
  }

  return (
    <>
      <Text style={typography.caption}>
        Áreas onde você quer evoluir (até {FOCUS_AREAS_MAX}) e o ritmo preferido. O Oráculo usa isso para sugerir missões.
      </Text>
      <Chips multiple options={AREA_OPTIONS} selected={areas} onToggle={(a) => setAreas((cur) => toggleFocusArea(cur, a))} />
      <Text style={typography.label}>RITMO</Text>
      <Chips options={DIFFICULTY_OPTIONS} selected={[difficulty]} onToggle={setDifficulty} />
      <FormMessage text={message?.text ?? null} tone={message?.tone} />
      {dirty && <Button title="Salvar preferências" onPress={save} loading={saving} />}
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
  const [value, setValue] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const dirty = value.trim() !== (initial ?? '');

  async function save() {
    const { value: name, error } = normalizeDisplayName(value);
    if (error) {
      setMessage({ text: error, tone: 'error' });
      return;
    }
    setSaving(true);
    const saveError = await onSave(name);
    setSaving(false);
    setMessage(saveError ? { text: saveError, tone: 'error' } : { text: 'Nome salvo.', tone: 'info' });
  }

  return (
    <>
      <Field label="Nome de exibição" value={value} onChangeText={setValue} placeholder="Como quer ser chamado" maxLength={60} />
      <FormMessage text={message?.text ?? null} tone={message?.tone} />
      {dirty && <Button title="Salvar nome" onPress={save} loading={saving} />}
    </>
  );
}

function TimeZoneForm({ current, onSave }: { current: string; onSave: (tz: string) => Promise<string | null> }) {
  const device = deviceTimeZone();
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  async function save(tz: string) {
    const trimmed = tz.trim();
    if (!isValidTimeZone(trimmed)) {
      setMessage({ text: 'Use um fuso no formato Região/Cidade, por exemplo America/Manaus.', tone: 'error' });
      return;
    }
    setSaving(true);
    const saveError = await onSave(trimmed);
    setSaving(false);
    setMessage(saveError ? { text: saveError, tone: 'error' } : { text: 'Fuso salvo.', tone: 'info' });
  }

  return (
    <>
      <Text style={typography.caption}>
        O fuso define quando o seu dia começa e termina: missões, streak e dia perfeito usam a data local.
      </Text>
      {device && device !== current && (
        <View style={styles.notice}>
          <Text style={typography.body}>O seu aparelho está em {device}.</Text>
          <Button title={`Usar ${device}`} onPress={() => save(device)} loading={saving} />
        </View>
      )}
      <Field
        label="Fuso horário"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="America/Sao_Paulo"
      />
      <FormMessage text={message?.text ?? null} tone={message?.tone} />
      {value.trim() !== current && <Button title="Salvar fuso" onPress={() => save(value)} loading={saving} />}
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
    Alert.alert('Desativar a IA?', 'A IA deixa de receber seus dados e não vai mais sugerir planos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => void toggle(false) },
    ]);
  }

  return (
    <>
      <View style={styles.switchRow}>
        <Text style={[typography.body, styles.switchLabel]}>Permitir que a IA use meus dados</Text>
        <Switch
          value={enabled}
          onValueChange={confirmToggle}
          disabled={saving}
          accessibilityLabel="Permitir que a IA use meus dados"
          trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
        />
      </View>
      <Text style={typography.caption}>
        Com a permissão, seus objetivos, hábitos e registros (sem nome nem e-mail) são enviados aos provedores de IA —
        Google Gemini e, quando ele está ocupado, Groq — só para sugerir planos. A IA só propõe: nada muda sem a sua
        aprovação, e ela nunca altera seu XP. Você pode desativar quando quiser.
      </Text>
      {enabled && consentAt && (
        <Text style={typography.caption}>Permitido em {new Date(consentAt).toLocaleDateString('pt-BR')}.</Text>
      )}
      <FormMessage text={error} />
    </>
  );
}

function SignOutButton() {
  const [loading, setLoading] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo com e-mail e senha.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
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

  return <Button title="Sair" onPress={confirmSignOut} variant="danger" loading={loading} />;
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
  notice: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchLabel: { flex: 1 },
});
