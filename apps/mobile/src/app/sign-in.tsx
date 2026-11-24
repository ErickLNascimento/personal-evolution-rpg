import { resolveTimeZone, validateCredentials, type AuthMode } from '@per/domain';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, FormMessage } from '@/components/Form';
import { authErrorMessage } from '@/features/auth/authErrors';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

export default function SignInScreen() {
  const { t, locale } = useT();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  function switchMode() {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setError(null);
    setInfo(null);
  }

  async function forgotPassword() {
    if (!supabase) return;
    setError(null);
    setInfo(null);
    // Reaproveita a validação de e-mail (a senha não importa aqui).
    const invalid = validateCredentials({ email, password: '-', mode: 'sign-in' }, locale);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Abre app/reset-password.tsx (evolutionrpg://… num build, exp://… no Expo Go).
      redirectTo: Linking.createURL('reset-password'),
    });
    setLoading(false);
    if (resetError) {
      setError(authErrorMessage(resetError));
      return;
    }
    // Mesma mensagem exista ou não a conta, para não revelar quem está cadastrado.
    setInfo(t('auth.resetSent'));
  }

  async function submit() {
    if (!supabase) return;
    setError(null);
    setInfo(null);

    const invalid = validateCredentials({ email, password, mode }, locale);
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);
    const credentials = { email: email.trim(), password };
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          ...credentials,
          options: {
            // O trigger handle_new_user grava esses dados no perfil.
            data: { display_name: displayName.trim(), timezone: resolveTimeZone(deviceTimeZone()) },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setInfo(t('auth.accountCreated'));
          setMode('sign-in');
          setPassword('');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword(credentials);
        if (signInError) throw signInError;
      }
      // Com sessão, o Stack.Protected do _layout leva para as abas.
    } catch (e) {
      setError(authErrorMessage(e as Error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={typography.title} accessibilityRole="header">
              Personal Evolution RPG
            </Text>
            <Text style={typography.caption}>
              {isSignUp ? t('auth.signUpTitle') : t('auth.signInTitle')}
            </Text>
          </View>

          <FormMessage text={info} tone="info" />

          {isSignUp && (
            <Field
              label={t('auth.displayName')}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('auth.optional')}
              autoComplete="name"
              textContentType="name"
              maxLength={60}
            />
          )}
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? t('auth.passwordHint') : undefined}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          <FormMessage text={error} />

          <Button
            title={isSignUp ? t('auth.createAccount') : t('auth.signIn')}
            onPress={submit}
            loading={loading}
          />
          {!isSignUp && (
            <Button
              title={t('auth.forgot')}
              onPress={forgotPassword}
              variant="secondary"
              disabled={loading}
            />
          )}
          <Button
            title={isSignUp ? t('auth.haveAccount') : t('auth.newAccount')}
            onPress={switchMode}
            variant="secondary"
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm, marginBottom: spacing.md },
});
