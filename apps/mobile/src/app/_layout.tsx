import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Form';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { CelebrationProvider } from '@/features/celebration/CelebrationProvider';
import { ProfileProvider, useProfile } from '@/features/profile/ProfileProvider';
import { useReminderSync, useReminderTapOpensToday } from '@/features/reminders/useReminderSync';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme/tokens';

const formHeader = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  // Sem isso o iOS mostra o nome da rota anterior, ex.: "(tabs)".
  headerBackTitle: 'Voltar',
} as const;

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function RootNavigator() {
  const { session, isLoading, isDemo } = useAuth();
  const { profile, loading: profileLoading, error: profileError, reload } = useProfile();
  useReminderSync(
    isDemo ? null : (session?.user.id ?? null),
    Boolean(profile?.onboardingDone),
    isLoading,
  );
  useReminderTapOpensToday();

  // Espera ler a sessão salva para não piscar a tela de login.
  if (isLoading) return <Loading />;

  const signedIn = isDemo || Boolean(session);

  // Logado: precisa do perfil para saber se o onboarding já foi feito.
  if (signedIn && !isDemo) {
    if (profileLoading) return <Loading />;
    if (!profile) {
      return (
        <View style={styles.center}>
          <Text style={typography.body}>
            {profileError ?? 'Não foi possível carregar o seu perfil.'}
          </Text>
          <Button title="Tentar de novo" onPress={reload} />
          <Button
            title="Sair"
            onPress={() => void supabase?.auth.signOut({ scope: 'local' })}
            variant="secondary"
          />
        </View>
      );
    }
  }

  const onboarded = isDemo || Boolean(profile?.onboardingDone);

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="habit/new" options={{ ...formHeader, title: 'Nova missão' }} />
        <Stack.Screen name="habit/[id]" options={{ ...formHeader, title: 'Hábito' }} />
        <Stack.Screen name="ai-plan" options={{ ...formHeader, title: 'Oráculo' }} />
        <Stack.Screen
          name="delete-account"
          options={{ ...formHeader, title: 'Excluir conta', presentation: 'modal' }}
        />
        <Stack.Screen
          name="hero"
          options={{ ...formHeader, title: 'Seu herói', presentation: 'modal' }}
        />
        <Stack.Screen name="path" options={{ ...formHeader, title: 'Caminho' }} />
        <Stack.Screen
          name="promotion"
          options={{ ...formHeader, title: 'Promoção', presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <CelebrationProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </CelebrationProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
});
