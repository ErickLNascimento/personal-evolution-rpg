import type { PostgrestError } from '@supabase/supabase-js';
import { xpTableFromRules, type LocalDate, type XpTable } from '@per/domain';
import { listHabits, type HabitRecord, type Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

export interface DayData {
  habits: HabitRecord[];
  /** Hábitos registrados por data: `logged.get('2026-11-22')` → ids. */
  logged: Map<LocalDate, Set<string>>;
  /** XP ganho em cada registro ativo, por `awardKey(data, hábito)`. */
  awarded: Map<string, number>;
  totalXp: number;
  /** Saldo de Cristais (só o banco concede ou gasta). */
  crystals: number;
  xpTable: XpTable;
}

/** Chave de `DayData.awarded`. */
export function awardKey(date: LocalDate, habitId: string): string {
  return `${date}:${habitId}`;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function rpcFailure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === '22023')
    return {
      data: null,
      error: 'Só dá para registrar hoje ou ontem, nos dias da agenda do hábito.',
    };
  if (error.code === 'P0002') return { data: null, error: 'Hábito não encontrado.' };
  if (/network|fetch/i.test(error.message))
    return { data: null, error: 'Sem conexão. Verifique a internet e tente de novo.' };
  return { data: null, error: fallback };
}

/** Tudo o que a tela Hoje precisa: hábitos, registros das datas, XP total e tabela de XP. */
export async function fetchDay(dates: readonly LocalDate[]): Promise<Result<DayData>> {
  const db = client();
  const [habits, logs, grants, xp, rules, crystals] = await Promise.all([
    listHabits(),
    db
      .from('habit_logs')
      .select('id, habit_id, local_date')
      .in('local_date', [...dates])
      .returns<{ id: string; habit_id: string; local_date: string }[]>(),
    // XP concedido a cada registro (source_id = id do registro); estornos não entram.
    db
      .from('xp_transactions')
      .select('source_id, amount')
      .eq('source_type', 'habit')
      .in('local_date', [...dates])
      .returns<{ source_id: string; amount: number }[]>(),
    db.rpc('my_total_xp'),
    db.from('xp_rules').select('key, amount').returns<{ key: string; amount: number }[]>(),
    db.rpc('my_coin_balance'),
  ]);

  if (habits.error !== null) return habits;
  if (logs.error) return rpcFailure(logs.error, 'Não foi possível carregar os registros.');
  if (xp.error) return rpcFailure(xp.error, 'Não foi possível carregar o seu XP.');

  const logged = new Map<LocalDate, Set<string>>(dates.map((d) => [d, new Set<string>()]));
  for (const l of logs.data) logged.get(l.local_date)?.add(l.habit_id);

  // Sem as transações, o card mostra o valor da dificuldade atual (missionXp).
  const amountByLog = new Map((grants.data ?? []).map((g) => [g.source_id, g.amount]));
  const awarded = new Map<string, number>();
  for (const l of logs.data) {
    const amount = amountByLog.get(l.id);
    if (amount !== undefined) awarded.set(awardKey(l.local_date, l.habit_id), amount);
  }

  return {
    data: {
      habits: habits.data,
      logged,
      awarded,
      totalXp: Number(xp.data ?? 0),
      crystals: Number(crystals.data ?? 0),
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
  /** XP extra da missão relâmpago (só no registro, dentro do prazo). */
  flashBonus: number;
  totalXp: number;
  /** Cristais ganhos (registro) ou estornados (desfazer) nesta ação. */
  crystals: number;
  crystalBalance: number;
  /** Títulos especiais concedidos agora (só no registro). */
  titles: string[];
}

export async function logHabit(habitId: string, date: LocalDate): Promise<Result<LogOutcome>> {
  const { data, error } = await client().rpc('log_habit', {
    p_habit_id: habitId,
    p_local_date: date,
  });
  if (error) return rpcFailure(error, 'Não foi possível registrar. Tente de novo.');
  const r = data as {
    logged: boolean;
    xp_awarded: number;
    perfect_day_bonus: number;
    flash_bonus?: number;
    total_xp: number;
    coins_awarded?: number;
    coin_balance?: number;
    titles_granted?: string[];
  };
  return {
    data: {
      changed: r.logged,
      xp: r.xp_awarded,
      perfectDayBonus: r.perfect_day_bonus,
      flashBonus: Number(r.flash_bonus ?? 0),
      totalXp: Number(r.total_xp),
      crystals: Number(r.coins_awarded ?? 0),
      crystalBalance: Number(r.coin_balance ?? 0),
      titles: r.titles_granted ?? [],
    },
    error: null,
  };
}

export async function undoHabitLog(habitId: string, date: LocalDate): Promise<Result<LogOutcome>> {
  const { data, error } = await client().rpc('undo_habit_log', {
    p_habit_id: habitId,
    p_local_date: date,
  });
  if (error) return rpcFailure(error, 'Não foi possível desfazer. Tente de novo.');
  const r = data as {
    undone: boolean;
    xp_reverted: number;
    total_xp: number;
    coins_reverted?: number;
    coin_balance?: number;
  };
  return {
    data: {
      changed: r.undone,
      xp: r.xp_reverted,
      perfectDayBonus: 0,
      flashBonus: 0,
      totalXp: Number(r.total_xp),
      crystals: Number(r.coins_reverted ?? 0),
      crystalBalance: Number(r.coin_balance ?? 0),
      titles: [],
    },
    error: null,
  };
}
