import { validateNewPassword } from '@per/domain';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button, Field, FormMessage } from '@/components/Form';
import { parseAuthRedirect } from '@/lib/authRedirect';
import { createRecoveryClient } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

/**
 * Aberta pelo link do e-mail "Redefinir senha" (evolutionrpg://reset-password#access_token=…).
 * Fica fora dos guards de login: funciona logado ou não.
 */
export default function ResetPasswordScreen() {
  const { t, locale } = useT();
  const url = Linking.useLinkingURL();
  const recovery = useMemo<SupabaseClient | null>(() => createRecoveryClient(), []);
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!url || !recovery) return;
    const p = parseAuthRedirect(url);
    // Sem tokens: pode ser a URL inicial antes do link chegar (erro explícito é tratado na renderização).
    if (!p.accessToken || !p.refreshToken) return;
    let active = true;
    recovery.auth
      .setSession({ access_token: p.accessToken, refresh_token: p.refreshToken })
      .then(({ error: e }) => {
        if (active) setStage(e ? 'invalid' : 'ready');
      });
    return () => {
      active = false;
    };
  }, [url, recovery]);

  // O Supabase põe error_description no link quando ele expirou ou já foi usado.
  const linkError = url ? parseAuthRedirect(url).error : null;
  const view: Stage = linkError && stage === 'checking' ? 'invalid' : stage;

  async function save() {
    if (!recovery) return;
    const invalid = validateNewPassword(password, confirmation, locale);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    const { error: e } = await recovery.auth.updateUser({ password });
    setSaving(false);
    if (e) {
      setError(e.code === 'same_password' ? t('auth.samePassword') : t('auth.passwordFailed'));
      return;
    }
    await recovery.auth.signOut({ scope: 'local' });
    setStage('done');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={typography.title} accessibilityRole="header">
            {t('auth.newPassword')}
          </Text>

          {view === 'checking' && (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={typography.caption}>{t('auth.checking')}</Text>
              <Button
                title={t('auth.back')}
                onPress={() => router.replace('/')}
                variant="secondary"
              />
            </>
          )}

          {view === 'invalid' && (
            <>
              <FormMessage text={t('auth.expired')} />
              <Button title={t('auth.backToLogin')} onPress={() => router.replace('/')} />
            </>
          )}

          {view === 'ready' && (
            <>
              <Field
                label={t('auth.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                placeholder={t('auth.passwordHint')}
              />
              <Field
                label={t('auth.repeatPassword')}
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                onSubmitEditing={save}
              />
              <FormMessage text={error} />
              <Button title={t('auth.savePassword')} onPress={save} loading={saving} />
            </>
          )}

          {view === 'done' && (
            <>
              <FormMessage text={t('auth.passwordChanged')} tone="info" />
              <Button title={t('auth.continue')} onPress={() => router.replace('/')} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
});
