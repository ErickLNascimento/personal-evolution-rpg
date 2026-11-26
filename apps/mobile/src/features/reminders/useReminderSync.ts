import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { clearReminders, syncReminders } from '@/lib/reminders';

/**
 * Mantém os lembretes deste aparelho em dia com os hábitos da conta:
 * sincroniza ao entrar e sempre que o app volta ao primeiro plano; apaga ao sair da conta.
 */
export function useReminderSync(userId: string | null, enabled: boolean, authLoading: boolean) {
  useEffect(() => {
    // Enquanto a sessão salva é lida, userId ainda é null: não é logout.
    if (authLoading) return;
    if (!userId) {
      void clearReminders().catch(() => undefined);
      return;
    }
    if (!enabled) return;
    void syncReminders().catch(() => undefined);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders().catch(() => undefined);
    });
    return () => sub.remove();
  }, [userId, enabled, authLoading]);
}

/**
 * Tocar num aviso abre a tela dele: o push do servidor traz `route` (ex.: /social); lembrete local
 * abre a aba Hoje, e o de promoção, a cerimônia. Vale também para o toque que abriu o app.
 */
export function useReminderTapOpensToday() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data ?? {};
      const route = typeof data.route === 'string' && data.route.startsWith('/') ? data.route : null;
      router.navigate((route ?? (data.kind === 'promotion' ? '/promotion' : '/')) as Href);
    };
    const first = Notifications.getLastNotificationResponse();
    if (first) {
      // Espera o navegador montar antes de abrir a tela do aviso.
      setTimeout(() => open(first), 300);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
