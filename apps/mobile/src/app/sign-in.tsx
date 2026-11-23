import { resolveTimeZone, validateCredentials, type AuthMode } from '@per/domain';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, FormMessage } from '@/components/Form';
import { authErrorMessage } from '@/features/auth/authErrors';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';

export default function SignInScreen() {
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

  async function submit() {
    if (!supabase) return;
    setError(null);
    setInfo(null);

    const invalid = validateCredentials({ email, password, mode });
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
          setInfo('Conta criada. Abra o link que enviamos para o seu e-mail e depois entre aqui.');
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
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={typography.title} accessibilityRole="header">
              Personal Evolution RPG
            </Text>
            <Text style={typography.caption}>
              {isSignUp ? 'Crie sua conta para começar a jornada.' : 'Entre para continuar a sua jornada.'}
            </Text>
          </View>

          <FormMessage text={info} tone="info" />

          {isSignUp && (
            <Field
              label="Como quer ser chamado"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Opcional"
              autoComplete="name"
              textContentType="name"
              maxLength={60}
            />
          )}
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignUp ? 'Pelo menos 8 caracteres' : undefined}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          <FormMessage text={error} />

          <Button title={isSignUp ? 'Criar conta' : 'Entrar'} onPress={submit} loading={loading} />
          <Button
            title={isSignUp ? 'Já tenho conta' : 'Criar uma conta'}
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
