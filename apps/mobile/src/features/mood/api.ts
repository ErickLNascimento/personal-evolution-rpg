import type { PostgrestError } from '@supabase/supabase-js';
import {
  isMood,
  MOOD_TAGS,
  type LocalDate,
  type Mood,
  type MoodEntry,
  type MoodTag,
} from '@per/domain';
import type { Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === '22023')
    return { data: null, error: 'Só dá para registrar o humor de hoje ou de ontem.' };
  // Banco ainda sem a migration do diário.
  if (error.code === 'PGRST202' || error.code === 'PGRST205' || error.code === '42P01')
    return { data: null, error: 'O diário ainda não está disponível. Tente mais tarde.' };
  if (/network|fetch/i.test(error.message))
    return { data: null, error: 'Sem conexão. Verifique a internet e tente de novo.' };
  return { data: null, error: fallback };
}

interface Row {
  local_date: string;
  mood: number;
  tags: string[];
  note: string | null;
}

/** Registros de humor desde `from` (só os do próprio usuário: RLS). */
export async function fetchMoodEntries(from: LocalDate): Promise<Result<MoodEntry[]>> {
  const { data, error } = await client()
    .from('mood_entries')
    .select('local_date, mood, tags, note')
    .gte('local_date', from)
    .order('local_date')
    .returns<Row[]>();
  if (error) return failure(error, 'Não foi possível carregar o diário.');
  return {
    data: data
      .filter((r) => isMood(r.mood))
      .map((r) => ({
        date: r.local_date,
        mood: r.mood as Mood,
        tags: r.tags.filter((t): t is MoodTag => (MOOD_TAGS as readonly string[]).includes(t)),
        note: r.note,
      })),
    error: null,
  };
}

/** Grava o humor do dia; o primeiro registro do dia rende Cristais (o banco decide). */
export async function saveMoodEntry(
  date: LocalDate,
  mood: Mood,
  tags: MoodTag[],
  note: string | null,
): Promise<Result<{ coins: number }>> {
  const { data, error } = await client().rpc('save_mood_entry', {
    p_local_date: date,
    p_mood: mood,
    p_tags: tags,
    p_note: note,
  });
  if (error) return failure(error, 'Não foi possível salvar o seu humor.');
  return {
    data: { coins: Number((data as { coins_awarded: number }).coins_awarded ?? 0) },
    error: null,
  };
}
