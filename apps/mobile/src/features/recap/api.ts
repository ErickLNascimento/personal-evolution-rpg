import {
  addDays,
  recapWeekStart,
  weeklyRecap,
  type LocalDate,
  type WeeklyRecap,
} from '@per/domain';
import { listHabits, type Result } from '@/features/habits/api';
import { fetchAll } from '@/features/progress/api';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** Resumo da semana anterior a `today` (duas semanas de registros e XP); null se não houve agenda. */
export async function fetchWeeklyRecap(
  today: LocalDate,
  /** Vida do chefe da semana resumida, em % (patente). */
  bossHpPct?: number,
): Promise<Result<WeeklyRecap | null>> {
  if (!supabase) return { data: null, error: null };
  const db = supabase;
  const from = addDays(recapWeekStart(today), -7);
  const [habits, logs, xp] = await Promise.all([
    listHabits(),
    fetchAll<{ habit_id: string; local_date: string }>((a, b) =>
      db
        .from('habit_logs')
        .select('habit_id, local_date')
        .gte('local_date', from)
        .lt('local_date', today)
        .order('local_date')
        .order('id')
        .range(a, b),
    ),
    fetchAll<{ amount: number; local_date: string }>((a, b) =>
      db
        .from('xp_transactions')
        .select('amount, local_date')
        .gte('local_date', from)
        .lt('local_date', today)
        .order('local_date')
        .order('id')
        .range(a, b),
    ),
  ]);
  if (habits.error !== null) return habits;
  if (!logs || !xp) return { data: null, error: t('recap.errorLoad') };
  return {
    data: weeklyRecap(
      habits.data,
      logs.map((l) => ({ habitId: l.habit_id, localDate: l.local_date })),
      xp.map((x) => ({ amount: x.amount, localDate: x.local_date })),
      today,
      bossHpPct,
    ),
    error: null,
  };
}

const seenKey = (userId: string) => `per.recap.seen.${userId}`;
const listeners = new Set<() => void>();

/** Semana (segunda) cuja crônica a pessoa já viu neste aparelho (some o ponto da aba). */
export function seenRecapWeek(userId: string): LocalDate | null {
  return globalThis.localStorage?.getItem(seenKey(userId)) ?? null;
}

export function markRecapSeen(userId: string, weekStart: LocalDate): void {
  if (seenRecapWeek(userId) === weekStart) return;
  globalThis.localStorage?.setItem(seenKey(userId), weekStart);
  for (const l of listeners) l();
}

/** Para useSyncExternalStore: avisa quando a crônica foi vista. */
export function subscribeRecapSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
