import type { HabitLogEntry, LocalDate, XpEntry } from '@per/domain';
import { listHabits, type HabitRecord, type Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

/** O PostgREST devolve no máximo 1000 linhas por chamada; lemos em páginas. */
const PAGE = 1000;

export interface WeeklyReview {
  createdAt: string;
  status: 'proposed' | 'accepted' | 'rejected';
  summary: string | null;
}

export interface ProgressData {
  habits: HabitRecord[];
  logs: HabitLogEntry[];
  xp: XpEntry[];
  totalXp: number;
  review: WeeklyReview | null;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

/** Texto curto da revisão, se o plano semanal da IA trouxer um resumo. */
function reviewSummary(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'summary' in payload) {
    const s = (payload as { summary: unknown }).summary;
    if (typeof s === 'string' && s.trim()) return s.trim();
  }
  return null;
}

/**
 * Dados da tela Progresso: registros desde `logsFrom` (para o streak),
 * XP desde `xpFrom` (gráfico e resumos), XP total e a última revisão semanal.
 */
export async function fetchProgress(logsFrom: LocalDate, xpFrom: LocalDate): Promise<Result<ProgressData>> {
  const db = client();
  const [habits, logs, xp, total, review] = await Promise.all([
    listHabits(),
    fetchAll<{ habit_id: string; local_date: string }>((a, b) =>
      db.from('habit_logs').select('habit_id, local_date').gte('local_date', logsFrom).order('local_date').order('id').range(a, b),
    ),
    fetchAll<{ amount: number; local_date: string }>((a, b) =>
      db.from('xp_transactions').select('amount, local_date').gte('local_date', xpFrom).order('local_date').order('id').range(a, b),
    ),
    db.rpc('my_total_xp'),
    db
      .from('ai_plans')
      .select('payload, status, created_at')
      .eq('kind', 'weekly')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ payload: unknown; status: WeeklyReview['status']; created_at: string }>(),
  ]);

  if (habits.error !== null) return habits;
  if (!logs || !xp || total.error) return { data: null, error: 'Não foi possível carregar o seu progresso.' };

  return {
    data: {
      habits: habits.data,
      logs: logs.map((l) => ({ habitId: l.habit_id, localDate: l.local_date })),
      xp: xp.map((x) => ({ amount: x.amount, localDate: x.local_date })),
      totalXp: Number(total.data ?? 0),
      // A revisão é opcional: se falhar, o resto da tela continua.
      review: review.data
        ? { createdAt: review.data.created_at, status: review.data.status, summary: reviewSummary(review.data.payload) }
        : null,
    },
    error: null,
  };
}
