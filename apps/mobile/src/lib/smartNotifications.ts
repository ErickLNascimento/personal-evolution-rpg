import { FEATURES, smartNotifications, stageName, type SmartNotification } from '@per/domain';
import { listHabits } from '@/features/habits/api';
import { fetchFlashMission, fetchHeroPath } from '@/features/hero/pathApi';
import { isFeatureOn } from '@/lib/featureSnapshot';
import { supabase } from '@/lib/supabase';

/**
 * Preferência deste aparelho: avisos de streak, missão relâmpago e promoção (padrão: ligados).
 * Fica no localStorage: no celular ele vem do expo-sqlite (instalado em lib/supabase.ts);
 * no web, é o do navegador.
 */
const KEY = 'smart-notifications';

export function smartNotificationsEnabled(): boolean {
  return globalThis.localStorage?.getItem(KEY) !== 'off';
}

export function setSmartNotificationsEnabled(on: boolean): void {
  globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off');
}

/** Data de hoje e minutos desde a meia-noite, na hora local do aparelho (a das notificações). */
function deviceNow(now: Date) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { today: `${y}-${m}-${d}`, nowMinutes: now.getHours() * 60 + now.getMinutes() };
}

/**
 * Monta os avisos inteligentes a agendar agora (lê hábitos, registros de hoje, missão
 * relâmpago e promoção). Falhas em alguma parte só deixam aquele aviso de fora.
 */
export async function buildSmartNotifications(): Promise<SmartNotification[]> {
  if (!supabase || !smartNotificationsEnabled() || !isFeatureOn(FEATURES.smartNotifications))
    return [];
  const now = new Date();
  const { today, nowMinutes } = deviceNow(now);

  const [habits, logs, flash, path] = await Promise.all([
    listHabits(),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('local_date', today)
      .returns<{ habit_id: string }[]>(),
    fetchFlashMission(),
    fetchHeroPath(),
  ]);
  if (habits.error !== null) return [];

  const flashHabit = flash.data ? habits.data.find((h) => h.id === flash.data!.habitId) : undefined;
  const p = path.data;
  const promotion =
    p && p.canPromote && p.path && p.next
      ? { nextName: p.needsBranch ? null : stageName(p.path, p.branch, p.next.tier) }
      : null;

  return smartNotifications({
    today,
    nowMinutes,
    now,
    habits: habits.data,
    completedToday: new Set((logs.data ?? []).map((l) => l.habit_id)),
    flash:
      flash.data && flashHabit
        ? { title: flashHabit.title, deadline: flash.data.deadline, done: flash.data.done }
        : null,
    promotion,
  });
}

/** Instante do disparo, na hora local do aparelho. */
export function triggerDate(n: SmartNotification): Date {
  if (n.kind === 'flash') return n.at;
  const [y, m, d] = n.date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, n.hour, n.minute);
}
