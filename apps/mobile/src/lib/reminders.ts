import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import {
  addDays,
  isOnVacation,
  MAX_SCHEDULED_REMINDERS,
  REPEAT_DAYS_AHEAD,
  reminderSchedule,
  repeatReminderDates,
  repeatsReminder,
  SMART_NOTIFICATION_SLOTS,
} from '@per/domain';
import { Platform } from 'react-native';
import { listHabits } from '@/features/habits/api';
import { t } from '@/i18n';
import { buildSmartNotifications, deviceNow, triggerDate } from '@/lib/smartNotifications';
import { supabase } from '@/lib/supabase';

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
  // De férias hoje: sem lembretes de hábito (eles se repetem toda semana e não sabem das datas).
  // Voltam na próxima sincronização depois das férias; o aviso de volta abre o app nesse dia.
  const { today } = deviceNow(new Date());
  const onVacation = isOnVacation(habits.data[0]?.vacations, today);
  // Vagas reservadas para os avisos inteligentes, dentro do limite do iOS.
  const { reminders, truncated } = onVacation
    ? { reminders: [], truncated: false }
    : reminderSchedule(habits.data, MAX_SCHEDULED_REMINDERS - SMART_NOTIFICATION_SLOTS);
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

  // Lembretes ao longo do dia (missões de contar): com data, de hoje a 3 dias, para não tocar
  // mais no dia em que a meta foi batida. Cada registro e cada volta ao app reagendam.
  const repeating = onVacation ? [] : habits.data.filter((h) => repeatsReminder(h));
  let repeatCount = 0;
  if (repeating.length > 0) {
    const nowDate = new Date();
    const { today: localToday, nowMinutes } = deviceNow(nowDate);
    const done = await doneToday(localToday, repeating.map((h) => h.id));
    const dates = Array.from({ length: REPEAT_DAYS_AHEAD }, (_, i) => {
      const date = addDays(localToday, i);
      return { date, weekday: new Date(`${date}T12:00:00`).getDay() };
    });
    const free = Math.max(0, MAX_SCHEDULED_REMINDERS - SMART_NOTIFICATION_SLOTS - reminders.length);
    const dated = repeatReminderDates(
      repeating,
      { date: localToday, hour: Math.floor(nowMinutes / 60), minute: nowMinutes % 60 },
      done,
      dates,
    ).slice(0, free);
    for (const r of dated) {
      const hh = String(r.hour).padStart(2, '0');
      const mm = String(r.minute).padStart(2, '0');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: t('notifications.repeatBody', { index: r.index, total: r.total }),
          data: { habitId: r.habitId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(`${r.date}T${hh}:${mm}:00`),
          channelId: CHANNEL_ID,
        },
      });
    }
    repeatCount = dated.length;
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
  return { scheduled: reminders.length + repeatCount + smart.length, truncated };
}

/** Hábitos (dentre `ids`) com a meta de hoje batida, pelos registros do dia. */
async function doneToday(today: string, ids: readonly string[]): Promise<Set<string>> {
  if (!supabase || ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id')
    .eq('local_date', today)
    .in('habit_id', [...ids]);
  if (error || !data) return new Set();
  return new Set(data.map((r: { habit_id: string }) => r.habit_id));
}
