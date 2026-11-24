import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/**
 * Relatório de erros, desempenho e logs (Sentry, projeto myliferpg/personal-evolution-rpg).
 * Liga quando há DSN (EXPO_PUBLIC_SENTRY_DSN no .env.local e nas variáveis do EAS); no web, não.
 *
 * Privacidade (LGPD): sem dados pessoais — o Sentry recebe só o id da conta, que basta para
 * cruzar um erro com um feedback. Replay só nas sessões com erro, com todo texto e imagem
 * mascarados.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = Boolean(DSN) && Platform.OS !== 'web';

/** Navegação do Expo Router: cada erro vem com a tela em que aconteceu. */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

if (sentryEnabled) {
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    environment: __DEV__ ? 'development' : Updates.channel || 'production',
    // Desempenho: tudo em desenvolvimento (para conferir), 10% em produção.
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    enableLogs: true,
    // Replay só quando há erro; texto, imagens e desenhos ficam mascarados.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      navigationIntegration,
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
      }),
    ],
  });
  // Qual atualização (EAS Update) estava rodando quando o erro aconteceu.
  const scope = Sentry.getGlobalScope();
  scope.setTag('expo-update-id', Updates.updateId ?? 'embedded');
  scope.setTag('expo-is-embedded-update', String(Updates.isEmbeddedLaunch));
}

/** Associa os próximos erros à conta (só o id), ou desassocia ao sair. */
export function setSentryUser(userId: string | null): void {
  if (!sentryEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Envolve o componente raiz (captura erros de renderização); sem Sentry, devolve o próprio. */
export function withSentry(
  component: React.ComponentType<Record<string, unknown>>,
): React.ComponentType<Record<string, unknown>> {
  return sentryEnabled ? Sentry.wrap(component) : component;
}
