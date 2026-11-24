import {
  addDays,
  SHIELD_LOOKBACK_DAYS,
  streakShieldDates,
  type HabitLogEntry,
  type LocalDate,
} from '@per/domain';
import type { PostgrestError } from '@supabase/supabase-js';
import { listHabits, type Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

export interface StreakShields {
  held: number;
  max: number;
  price: number;
  /** Dias protegidos por escudo (últimos 120 dias). */
  usedDates: ReadonlySet<LocalDate>;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === 'PR020') return { data: null, error: 'Você já tem o máximo de escudos.' };
  if (error.code === 'PR004') return { data: null, error: 'Cristais insuficientes para o escudo.' };
  if (/network|fetch/i.test(error.message))
    return { data: null, error: 'Sem conexão. Verifique a internet e tente de novo.' };
  return { data: null, error: fallback };
}

export async function fetchShields(): Promise<Result<StreakShields>> {
  const { data, error } = await client().rpc('my_streak_shields');
  if (error) return failure(error, 'Não foi possível carregar os escudos.');
  const r = data as { held: number; max: number; price: number; used_dates: string[] };
  return {
    data: { held: r.held, max: r.max, price: r.price, usedDates: new Set(r.used_dates) },
    error: null,
  };
}

/** Compra um escudo (o banco confere limite e saldo). */
export async function buyShield(): Promise<Result<{ held: number; crystals: number }>> {
  const { data, error } = await client().rpc('buy_streak_shield');
  if (error) return failure(error, 'Não foi possível comprar o escudo. Tente de novo.');
  const r = data as { held: number; coin_balance: number };
  return { data: { held: r.held, crystals: r.coin_balance }, error: null };
}

/**
 * Usa automaticamente os escudos guardados nos dias que quebrariam o streak.
 * Só lê o histórico se houver escudo; devolve os dias protegidos agora (vazio = nada a fazer).
 * Falhas são silenciosas: na próxima abertura o app tenta de novo.
 */
export async function autoProtectStreak(today: LocalDate): Promise<LocalDate[]> {
  const shields = await fetchShields();
  if (shields.error !== null || shields.data.held <= 0) return [];

  const db = client();
  const [habits, logs] = await Promise.all([
    listHabits(),
    db
      .from('habit_logs')
      .select('habit_id, local_date')
      .gte('local_date', addDays(today, -(SHIELD_LOOKBACK_DAYS - 1)))
      .returns<{ habit_id: string; local_date: string }[]>(),
  ]);
  if (habits.error !== null || logs.error) return [];

  const entries: HabitLogEntry[] = (logs.data ?? []).map((l) => ({
    habitId: l.habit_id,
    localDate: l.local_date,
  }));
  const dates = streakShieldDates(
    habits.data,
    entries,
    today,
    shields.data.held,
    shields.data.usedDates,
  );
  const protectedNow: LocalDate[] = [];
  for (const date of dates) {
    const { data, error } = await db.rpc('use_streak_shield', { p_local_date: date });
    if (error) break;
    if ((data as { used: boolean }).used) protectedNow.push(date);
  }
  return protectedNow;
}
