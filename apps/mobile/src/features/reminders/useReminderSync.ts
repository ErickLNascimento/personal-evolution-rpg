import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
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

/** Tocar num lembrete abre a aba Hoje, onde a missão é concluída. */
export function useReminderTapOpensToday() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate('/');
    });
    return () => sub.remove();
  }, []);
}
