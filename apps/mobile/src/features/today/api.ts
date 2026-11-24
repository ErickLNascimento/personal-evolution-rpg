import type { PostgrestError } from '@supabase/supabase-js';
import { xpTableFromRules, type LocalDate, type XpTable } from '@per/domain';
import { listHabits, type HabitRecord, type Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

export interface DayData {
  habits: HabitRecord[];
  /** Hábitos registrados por data: `logged.get('2026-11-22')` → ids. */
  logged: Map<LocalDate, Set<string>>;
  /** XP ganho em cada registro ativo, por `awardKey(data, hábito)`. */
  awarded: Map<string, number>;
  /** Contagem do dia nos hábitos contador, por `awardKey(data, hábito)`. */
  counts: Map<string, number>;
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
      error: t('errors.loggableOnly'),
    };
  if (error.code === 'P0002') return { data: null, error: t('errors.habitNotFound') };
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
  return { data: null, error: fallback };
}

/** Tudo o que a tela Hoje precisa: hábitos, registros das datas, XP total e tabela de XP. */
export async function fetchDay(dates: readonly LocalDate[]): Promise<Result<DayData>> {
  const db = client();
  const [habits, logs, grants, xp, rules, crystals, counts] = await Promise.all([
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
    db
      .from('habit_counts')
      .select('habit_id, local_date, qty')
      .in('local_date', [...dates])
      .returns<{ habit_id: string; local_date: string; qty: number }[]>(),
  ]);

  if (habits.error !== null) return habits;
  if (logs.error) return rpcFailure(logs.error, t('errors.loadLogs'));
  if (xp.error) return rpcFailure(xp.error, t('errors.loadXp'));

  const logged = new Map<LocalDate, Set<string>>(dates.map((d) => [d, new Set<string>()]));
  for (const l of logs.data) logged.get(l.local_date)?.add(l.habit_id);

  // Sem as transações, o card mostra o valor da dificuldade atual (missionXp).
  const amountByLog = new Map((grants.data ?? []).map((g) => [g.source_id, g.amount]));
  const awarded = new Map<string, number>();
  for (const l of logs.data) {
    const amount = amountByLog.get(l.id);
    if (amount !== undefined) awarded.set(awardKey(l.local_date, l.habit_id), amount);
  }

  // Sem as contagens (ex.: banco ainda sem a migration), o contador começa do zero.
  const countMap = new Map(
    (counts.data ?? []).map((c) => [awardKey(c.local_date, c.habit_id), c.qty]),
  );

  return {
    data: {
      habits: habits.data,
      logged,
      awarded,
      counts: countMap,
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
  if (error) return rpcFailure(error, t('errors.log'));
  return { data: logOutcome(data as LogResponse), error: null };
}

interface LogResponse {
  logged: boolean;
  xp_awarded: number;
  perfect_day_bonus: number;
  flash_bonus?: number;
  total_xp: number;
  coins_awarded?: number;
  coin_balance?: number;
  titles_granted?: string[];
}

interface UndoResponse {
  undone: boolean;
  xp_reverted: number;
  total_xp: number;
  coins_reverted?: number;
  coin_balance?: number;
}

function logOutcome(r: LogResponse): LogOutcome {
  return {
    changed: r.logged,
    xp: r.xp_awarded,
    perfectDayBonus: r.perfect_day_bonus,
    flashBonus: Number(r.flash_bonus ?? 0),
    totalXp: Number(r.total_xp),
    crystals: Number(r.coins_awarded ?? 0),
    crystalBalance: Number(r.coin_balance ?? 0),
    titles: r.titles_granted ?? [],
  };
}

function undoOutcome(r: UndoResponse): LogOutcome {
  return {
    changed: r.undone,
    xp: r.xp_reverted,
    perfectDayBonus: 0,
    flashBonus: 0,
    totalXp: Number(r.total_xp),
    crystals: Number(r.coins_reverted ?? 0),
    crystalBalance: Number(r.coin_balance ?? 0),
    titles: [],
  };
}

export async function undoHabitLog(habitId: string, date: LocalDate): Promise<Result<LogOutcome>> {
  const { data, error } = await client().rpc('undo_habit_log', {
    p_habit_id: habitId,
    p_local_date: date,
  });
  if (error) return rpcFailure(error, t('errors.undo'));
  return { data: undoOutcome(data as UndoResponse), error: null };
}

export interface CountOutcome {
  qty: number;
  done: boolean;
  /** Se a contagem concluiu (`logged`) ou desfez (`undone`) a missão, o resultado do banco. */
  change: { kind: 'logged' | 'undone'; outcome: LogOutcome } | null;
}

/** Grava a contagem do dia (valor absoluto); o banco conclui ou desfaz a missão pela meta. */
export async function setHabitCount(
  habitId: string,
  date: LocalDate,
  qty: number,
): Promise<Result<CountOutcome>> {
  const { data, error } = await client().rpc('set_habit_count', {
    p_habit_id: habitId,
    p_local_date: date,
    p_qty: qty,
  });
  if (error) return rpcFailure(error, t('errors.count'));
  const r = data as {
    qty: number;
    done: boolean;
    log: LogResponse | null;
    undo: UndoResponse | null;
  };
  const change = r.log
    ? { kind: 'logged' as const, outcome: logOutcome(r.log) }
    : r.undo
      ? { kind: 'undone' as const, outcome: undoOutcome(r.undo) }
      : null;
  return { data: { qty: r.qty, done: r.done, change }, error: null };
}
