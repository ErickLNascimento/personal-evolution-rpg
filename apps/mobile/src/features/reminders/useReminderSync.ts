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
