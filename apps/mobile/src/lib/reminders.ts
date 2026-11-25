import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { MAX_SCHEDULED_REMINDERS, reminderSchedule, SMART_NOTIFICATION_SLOTS } from '@per/domain';
import { Platform } from 'react-native';
import { listHabits } from '@/features/habits/api';
import { t } from '@/i18n';
import { buildSmartNotifications, triggerDate } from '@/lib/smartNotifications';

const CHANNEL_ID = 'reminders';
/** Canal dos avisos de streak, missão relâmpago e promoção (desligável à parte no Android). */
const SMART_CHANNEL_ID = 'hero-alerts';

// Mostra o lembrete mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  // Android 8+ exige um canal; no Android 13 o pedido de permissão só aparece depois dele.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('notifications.channelHabits'),
      importance: AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(SMART_CHANNEL_ID, {
      name: t('notifications.channelSmart'),
      importance: AndroidImportance.DEFAULT,
    });
  }
}

/** Pede permissão se ainda não foi decidida. `true` se pode notificar. */
export async function ensureReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted;
}

/** Apaga os lembretes deste aparelho (ex.: ao sair da conta). */
export async function clearReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Reagenda tudo a partir dos hábitos ativos: apaga os lembretes deste aparelho
 * e cria de novo. Idempotente; sem permissão, só apaga.
 * Devolve `truncated` quando passou do limite do aparelho.
 */
type SyncResult = { scheduled: number; truncated: boolean } | null;

// Uma sincronização por vez: chamadas sobrepostas (salvar + voltar ao app) duplicariam lembretes.
let queue: Promise<SyncResult> = Promise.resolve(null);

export function syncReminders(): Promise<SyncResult> {
  queue = queue.then(runSync, runSync);
  return queue;
}

async function runSync(): Promise<SyncResult> {
  const habits = await listHabits();
  if (habits.error !== null) return null;

  await clearReminders();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { scheduled: 0, truncated: false };

  await ensureChannel();
  // Vagas reservadas para os avisos inteligentes, dentro do limite do iOS.
  const { reminders, truncated } = reminderSchedule(
    habits.data,
    MAX_SCHEDULED_REMINDERS - SMART_NOTIFICATION_SLOTS,
  );
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: r.title,
        body: t('notifications.reminderBody'),
        data: { habitId: r.habitId },
      },
      trigger:
        r.weekday === null
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: r.hour,
              minute: r.minute,
              channelId: CHANNEL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: r.weekday,
              hour: r.hour,
              minute: r.minute,
              channelId: CHANNEL_ID,
            },
    });
  }

  // Avisos inteligentes: streak em risco, missão relâmpago e promoção.
  const smart = await buildSmartNotifications().catch(() => []);
  const now = Date.now();
  for (const n of smart) {
    const date = triggerDate(n);
    if (date.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: n.title, body: n.body, data: { kind: n.kind } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: SMART_CHANNEL_ID,
      },
    });
  }
  return { scheduled: reminders.length + smart.length, truncated };
}
