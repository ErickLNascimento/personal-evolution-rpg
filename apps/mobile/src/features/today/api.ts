import type { PostgrestError } from '@supabase/supabase-js';
import { xpTableFromRules, type LocalDate, type XpTable } from '@per/domain';
import { listHabits, type HabitRecord, type Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

export interface DayData {
  habits: HabitRecord[];
  /** Hábitos registrados por data: `logged.get('2026-11-22')` → ids. */
  logged: Map<LocalDate, Set<string>>;
  totalXp: number;
  xpTable: XpTable;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function rpcFailure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === '22023') return { data: null, error: 'Só dá para registrar hoje ou ontem, nos dias da agenda do hábito.' };
  if (error.code === 'P0002') return { data: null, error: 'Hábito não encontrado.' };
  if (/network|fetch/i.test(error.message)) return { data: null, error: 'Sem conexão. Verifique a internet e tente de novo.' };
  return { data: null, error: fallback };
}

/** Tudo o que a tela Hoje precisa: hábitos, registros das datas, XP total e tabela de XP. */
export async function fetchDay(dates: readonly LocalDate[]): Promise<Result<DayData>> {
  const db = client();
  const [habits, logs, xp, rules] = await Promise.all([
    listHabits(),
    db.from('habit_logs').select('habit_id, local_date').in('local_date', [...dates]).returns<{ habit_id: string; local_date: string }[]>(),
    db.rpc('my_total_xp'),
    db.from('xp_rules').select('key, amount').returns<{ key: string; amount: number }[]>(),
  ]);

  if (habits.error !== null) return habits;
  if (logs.error) return rpcFailure(logs.error, 'Não foi possível carregar os registros.');
  if (xp.error) return rpcFailure(xp.error, 'Não foi possível carregar o seu XP.');

  const logged = new Map<LocalDate, Set<string>>(dates.map((d) => [d, new Set<string>()]));
  for (const l of logs.data) logged.get(l.local_date)?.add(l.habit_id);

  return {
    data: {
      habits: habits.data,
      logged,
      totalXp: Number(xp.data ?? 0),
      // Sem as regras, a tela mostra o padrão; o XP real é sempre o que o banco concede.
      xpTable: xpTableFromRules(rules.data ?? []),
    },
    error: null,
  };
}

export interface LogOutcome {
  /** `false` quando já estava registrado (idempotente). */
  changed: boolean;
  /** XP do hábito ganho (registro), ou total estornado ao desfazer, já com o bônus. */
  xp: number;
  perfectDayBonus: number;
  totalXp: number;
}

export async function logHabit(habitId: string, date: LocalDate): Promise<Result<LogOutcome>> {
  const { data, error } = await client().rpc('log_habit', { p_habit_id: habitId, p_local_date: date });
  if (error) return rpcFailure(error, 'Não foi possível registrar. Tente de novo.');
  const r = data as { logged: boolean; xp_awarded: number; perfect_day_bonus: number; total_xp: number };
  return {
    data: { changed: r.logged, xp: r.xp_awarded, perfectDayBonus: r.perfect_day_bonus, totalXp: Number(r.total_xp) },
    error: null,
  };
}

export async function undoHabitLog(habitId: string, date: LocalDate): Promise<Result<LogOutcome>> {
  const { data, error } = await client().rpc('undo_habit_log', { p_habit_id: habitId, p_local_date: date });
  if (error) return rpcFailure(error, 'Não foi possível desfazer. Tente de novo.');
  const r = data as { undone: boolean; xp_reverted: number; total_xp: number };
  return { data: { changed: r.undone, xp: r.xp_reverted, perfectDayBonus: 0, totalXp: Number(r.total_xp) }, error: null };
}
