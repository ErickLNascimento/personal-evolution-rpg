import type { PostgrestError } from '@supabase/supabase-js';
import {
  addDays,
  startOfWeek,
  type Journey,
  type JourneyStatus,
  type LocalDate,
} from '@per/domain';
import { listHabits, type HabitRecord, type Result } from '@/features/habits/api';
import { fetchAll } from '@/features/progress/api';
import { supabase } from '@/lib/supabase';

export interface JourneyRecord extends Journey {
  finishedAt: string | null;
}

export interface ChallengesData {
  habits: HabitRecord[];
  journeys: JourneyRecord[];
  /** Hábitos registrados por data, desde o início da jornada ativa mais antiga (ou da semana passada). */
  logged: Map<LocalDate, Set<string>>;
  /** Segundas-feiras cujo chefe já foi resgatado (desta semana e da anterior). */
  bossClaimed: Set<LocalDate>;
  crystals: number;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === 'PR030') return { data: null, error: 'Este hábito já está numa jornada.' };
  if (error.code === 'PR031') return { data: null, error: 'Você já tem 3 jornadas em andamento.' };
  if (error.code === 'PR032') return { data: null, error: 'O chefe ainda não foi derrotado.' };
  if (/network|fetch/i.test(error.message))
    return { data: null, error: 'Sem conexão. Verifique a internet e tente de novo.' };
  return { data: null, error: fallback };
}

interface JourneyRow {
  id: string;
  habit_id: string;
  length_days: 21 | 66;
  start_date: string;
  status: JourneyStatus;
  finished_at: string | null;
}

export async function fetchChallenges(today: LocalDate): Promise<Result<ChallengesData>> {
  const db = client();
  const lastWeek = addDays(startOfWeek(today), -7);
  const [habits, journeys, balance, claims] = await Promise.all([
    listHabits(),
    db
      .from('journeys')
      .select('id, habit_id, length_days, start_date, status, finished_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .returns<JourneyRow[]>(),
    db.rpc('my_coin_balance'),
    db
      .from('coin_transactions')
      .select('item_id')
      .eq('source_type', 'challenge')
      .in('item_id', [`boss:${lastWeek}`, `boss:${startOfWeek(today)}`])
      .returns<{ item_id: string }[]>(),
  ]);
  if (habits.error !== null) return habits;
  if (journeys.error) return failure(journeys.error, 'Não foi possível carregar os desafios.');

  const list: JourneyRecord[] = journeys.data.map((j) => ({
    id: j.id,
    habitId: j.habit_id,
    lengthDays: j.length_days,
    startDate: j.start_date,
    status: j.status,
    finishedAt: j.finished_at,
  }));
  const from = list
    .filter((j) => j.status === 'active')
    .reduce((min, j) => (j.startDate < min ? j.startDate : min), lastWeek);
  const logs = await fetchAll<{ habit_id: string; local_date: string }>((a, b) =>
    db
      .from('habit_logs')
      .select('habit_id, local_date')
      .gte('local_date', from)
      .order('local_date')
      .order('id')
      .range(a, b),
  );
  if (!logs) return { data: null, error: 'Não foi possível carregar os desafios.' };

  const logged = new Map<LocalDate, Set<string>>();
  for (const l of logs) {
    const set = logged.get(l.local_date) ?? new Set<string>();
    set.add(l.habit_id);
    logged.set(l.local_date, set);
  }

  return {
    data: {
      habits: habits.data,
      journeys: list,
      logged,
      bossClaimed: new Set((claims.data ?? []).map((c) => c.item_id.slice('boss:'.length))),
      crystals: Number(balance.data ?? 0),
    },
    error: null,
  };
}

export async function startJourney(habitId: string, lengthDays: 21 | 66): Promise<Result<true>> {
  const { error } = await client().rpc('start_journey', {
    p_habit_id: habitId,
    p_length: lengthDays,
  });
  if (error) return failure(error, 'Não foi possível começar a jornada.');
  return { data: true, error: null };
}

export interface Reward {
  coins: number;
  balance: number;
}

/** Fecha a jornada se o resultado já está decidido (o banco confere e paga). */
export async function resolveJourney(
  id: string,
): Promise<Result<{ status: JourneyStatus } & Reward>> {
  const { data, error } = await client().rpc('resolve_journey', { p_journey_id: id });
  if (error) return failure(error, 'Não foi possível atualizar a jornada.');
  const r = data as { status: JourneyStatus; coins_awarded: number; coin_balance: number };
  return {
    data: { status: r.status, coins: Number(r.coins_awarded), balance: Number(r.coin_balance) },
    error: null,
  };
}

export async function abandonJourney(id: string): Promise<Result<true>> {
  const { error } = await client().rpc('abandon_journey', { p_journey_id: id });
  if (error) return failure(error, 'Não foi possível encerrar a jornada.');
  return { data: true, error: null };
}

export async function claimBoss(weekStart: LocalDate): Promise<Result<Reward>> {
  const { data, error } = await client().rpc('claim_weekly_boss', { p_week_start: weekStart });
  if (error) return failure(error, 'Não foi possível resgatar o prêmio.');
  const r = data as { coins_awarded: number; coin_balance: number };
  return { data: { coins: Number(r.coins_awarded), balance: Number(r.coin_balance) }, error: null };
}
