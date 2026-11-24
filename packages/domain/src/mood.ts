/**
 * Diário de humor (espelha 20261126000200_mood_journal.sql): um registro por dia, com humor
 * de 1 a 5, sentimentos de uma lista fixa e uma nota curta. Só o dono vê.
 */
import { addDays, type LocalDate } from './dates';
import type { DayStatus } from './streak';

export type Mood = 1 | 2 | 3 | 4 | 5;
export const MOODS: readonly Mood[] = [1, 2, 3, 4, 5];
export const MOOD_LABEL: Record<Mood, string> = {
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Ok',
  4: 'Bem',
  5: 'Ótimo',
};

export const MOOD_TAGS = [
  'motivado',
  'cansado',
  'ansioso',
  'grato',
  'calmo',
  'estressado',
] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];
export const MOOD_TAG_LABEL: Record<MoodTag, string> = {
  motivado: 'Motivado',
  cansado: 'Cansado',
  ansioso: 'Ansioso',
  grato: 'Grato',
  calmo: 'Calmo',
  estressado: 'Estressado',
};
export const MOOD_NOTE_MAX = 500;
/** Cristais do primeiro check-in do dia (padrão; o banco usa coin_rules). */
export const MOOD_CHECKIN_REWARD = 3;

export interface MoodEntry {
  date: LocalDate;
  mood: Mood;
  tags: MoodTag[];
  note: string | null;
}

export function isMood(v: unknown): v is Mood {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

/** Limpa os sentimentos (só os da lista, sem repetir, em ordem) e a nota. */
export function cleanMoodInput(
  tags: readonly string[],
  note: string,
): { tags: MoodTag[]; note: string | null; error: string | null } {
  const clean = MOOD_TAGS.filter((t) => tags.includes(t));
  const n = note.trim();
  if (n.length > MOOD_NOTE_MAX)
    return { tags: clean, note: n, error: `Use no máximo ${MOOD_NOTE_MAX} caracteres.` };
  return { tags: clean, note: n || null, error: null };
}

/** Os últimos `days` dias (o mais antigo primeiro) com o humor de cada um, se houver. */
export function moodStrip(
  entries: readonly MoodEntry[],
  today: LocalDate,
  days = 14,
): { date: LocalDate; mood: Mood | null }[] {
  const byDate = new Map(entries.map((e) => [e.date, e.mood]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, mood: byDate.get(date) ?? null };
  });
}

/** Dias de cada lado necessários para a comparação valer. */
export const MOOD_INSIGHT_MIN_DAYS = 3;

export interface MoodInsight {
  /** Humor médio nos dias com todas as missões feitas. */
  completeAvg: number;
  /** Humor médio nos dias com missão perdida. */
  missedAvg: number;
  completeDays: number;
  missedDays: number;
}

/**
 * Compara o humor dos dias em que todas as missões foram feitas com o dos outros dias.
 * `null` até haver ao menos MOOD_INSIGHT_MIN_DAYS de cada lado.
 */
export function moodInsight(
  entries: readonly MoodEntry[],
  statusByDate: ReadonlyMap<LocalDate, DayStatus>,
): MoodInsight | null {
  const complete: number[] = [];
  const missed: number[] = [];
  for (const e of entries) {
    const s = statusByDate.get(e.date);
    if (s === 'complete') complete.push(e.mood);
    else if (s === 'missed') missed.push(e.mood);
  }
  if (complete.length < MOOD_INSIGHT_MIN_DAYS || missed.length < MOOD_INSIGHT_MIN_DAYS) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    completeAvg: avg(complete),
    missedAvg: avg(missed),
    completeDays: complete.length,
    missedDays: missed.length,
  };
}

/** Texto da descoberta, em português. */
export function moodInsightText(i: MoodInsight): string {
  const f = (n: number) => n.toFixed(1).replace('.', ',');
  const diff = i.completeAvg - i.missedAvg;
  if (Math.abs(diff) < 0.3)
    return `Seu humor fica parecido com ou sem todas as missões feitas (${f(i.completeAvg)} e ${f(i.missedAvg)}).`;
  return diff > 0
    ? `Nos dias em que você cumpre todas as missões, seu humor é em média ${f(i.completeAvg)}; nos outros, ${f(i.missedAvg)}.`
    : `Curioso: nos dias com todas as missões feitas seu humor é ${f(i.completeAvg)}, e nos outros ${f(i.missedAvg)}. Talvez a rotina esteja pesada?`;
}
