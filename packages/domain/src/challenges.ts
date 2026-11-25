/**
 * Desafios com prazo (igual às funções do banco em 20261125000400_challenges.sql).
 *
 * Jornada: o usuário escolhe um hábito e um prazo (21 ou 66 dias). Vence quem fizer o
 * hábito em pelo menos JOURNEY_PASS_PCT% dos dias da agenda dentro do prazo. Dá para
 * vencer antes do fim (já bateu o mínimo) e perder antes (as faltas já passaram do limite).
 *
 * Chefe da semana: a vida do chefe é BOSS_PASS_PCT% das missões agendadas na semana
 * (segunda a domingo); cada missão feita tira 1 de vida.
 *
 * Os prêmios são Cristais, concedidos só pelo banco (o XP só sai de log_habit).
 */
import { addDays, compareLocalDates, startOfWeek, type LocalDate } from './dates';
import { isHabitScheduledOn, LOGGABLE_DAYS_BACK, type Habit } from './schedule';
import { BOSS_EN } from './contentEn';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export const JOURNEY_LENGTHS = [21, 66] as const;
export type JourneyLength = (typeof JOURNEY_LENGTHS)[number];
export const JOURNEY_PASS_PCT = 80;
/** Jornadas ativas ao mesmo tempo, no máximo (igual ao banco). */
export const MAX_ACTIVE_JOURNEYS = 3;
/** Cristais por jornada vencida (padrão; o banco usa coin_rules). */
export const JOURNEY_REWARD: Record<JourneyLength, number> = { 21: 120, 66: 450 };
export const BOSS_PASS_PCT = 80;
export const BOSS_REWARD = 40;

export type JourneyStatus = 'active' | 'won' | 'lost' | 'abandoned';

export interface Journey {
  id: string;
  habitId: string;
  lengthDays: JourneyLength;
  startDate: LocalDate;
  status: JourneyStatus;
}

export function journeyEnd(startDate: LocalDate, lengthDays: number): LocalDate {
  return addDays(startDate, lengthDays - 1);
}

export interface JourneyProgress {
  /** Dia atual da jornada (1 … lengthDays). */
  day: number;
  endDate: LocalDate;
  /** Dias da agenda dentro do prazo. */
  scheduled: number;
  /** Dias feitos necessários para vencer. */
  required: number;
  done: number;
  /** Dias da agenda que já fecharam sem registro. */
  missed: number;
  /** Faltas que ainda cabem sem perder a jornada. */
  missesLeft: number;
  /** Resultado já decidido, ou `null` enquanto está em jogo. */
  outcome: 'won' | 'lost' | null;
}

export function journeyRequired(scheduled: number): number {
  return Math.ceil((scheduled * JOURNEY_PASS_PCT) / 100);
}

export function journeyProgress(
  habit: Habit,
  logged: ReadonlySet<LocalDate>,
  journey: Pick<Journey, 'startDate' | 'lengthDays'>,
  today: LocalDate,
): JourneyProgress {
  const endDate = journeyEnd(journey.startDate, journey.lengthDays);
  const closedUntil = addDays(today, -(LOGGABLE_DAYS_BACK + 1)); // anteontem: já não aceita registro
  let scheduled = 0;
  let done = 0;
  let missed = 0;
  for (let d = journey.startDate; compareLocalDates(d, endDate) <= 0; d = addDays(d, 1)) {
    if (logged.has(d)) done += 1;
    if (!isHabitScheduledOn(habit, d)) continue;
    scheduled += 1;
    if (!logged.has(d) && compareLocalDates(d, closedUntil) <= 0) missed += 1;
  }
  const required = journeyRequired(scheduled);
  const missesAllowed = scheduled - required;
  const closed = compareLocalDates(endDate, closedUntil) <= 0;
  const outcome =
    scheduled > 0 && done >= required ? 'won' : missed > missesAllowed || closed ? 'lost' : null;
  const elapsed = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${journey.startDate}T00:00:00Z`)) / 86_400_000,
  );
  return {
    day: Math.min(journey.lengthDays, Math.max(1, elapsed + 1)),
    endDate,
    scheduled,
    required,
    done,
    missed,
    missesLeft: Math.max(0, missesAllowed - missed),
    outcome,
  };
}

/** Pode começar uma jornada com este hábito? Mensagem em português se não. */
export function canStartJourney(
  habitId: string,
  journeys: readonly Pick<Journey, 'habitId' | 'status'>[],
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const en = locale === 'en';
  const active = journeys.filter((j) => j.status === 'active');
  if (active.some((j) => j.habitId === habitId))
    return en ? 'This habit is already on a journey.' : 'Este hábito já está numa jornada.';
  if (active.length >= MAX_ACTIVE_JOURNEYS)
    return en
      ? `You already have ${MAX_ACTIVE_JOURNEYS} journeys in progress.`
      : `Você já tem ${MAX_ACTIVE_JOURNEYS} jornadas em andamento.`;
  return null;
}

// ─────────────────────────────────────────────────────────────
// Chefe da semana
// ─────────────────────────────────────────────────────────────

export interface Boss {
  id: string;
  name: string;
  /** Frase curta do chefe. */
  taunt: string;
}

export const BOSSES: readonly Boss[] = [
  { id: 'golem', name: 'Golem da Preguiça', taunt: 'Fique mais cinco minutos na cama...' },
  { id: 'hidra', name: 'Hidra da Distração', taunt: 'Só mais um vídeo. E outro. E outro.' },
  { id: 'lich', name: 'Lich da Procrastinação', taunt: 'Amanhã é um dia melhor para começar.' },
  { id: 'dragao', name: 'Dragão do Cansaço', taunt: 'Você merece pular hoje.' },
  { id: 'sombra', name: 'Sombra da Dúvida', taunt: 'Para que tentar? Não vai dar certo.' },
  { id: 'basilisco', name: 'Basilisco da Tela', taunt: 'Olhe para mim. Só mais uma rolagem.' },
];

/** Nome e provocação do chefe no idioma. */
export function bossText(boss: Boss, locale: Locale = DEFAULT_LOCALE): { name: string; taunt: string } {
  return (locale === 'en' ? BOSS_EN[boss.id] : undefined) ?? { name: boss.name, taunt: boss.taunt };
}

/** Chefe da semana: gira pela lista, igual para todo mundo na mesma semana. */
export function bossForWeek(weekStart: LocalDate): Boss {
  const weeks = Math.floor(Date.parse(`${weekStart}T00:00:00Z`) / (7 * 86_400_000));
  return BOSSES[((weeks % BOSSES.length) + BOSSES.length) % BOSSES.length]!;
}

export interface WeeklyBoss {
  boss: Boss;
  weekStart: LocalDate;
  weekEnd: LocalDate;
  /** Vida total: BOSS_PASS_PCT% das missões agendadas na semana. */
  maxHp: number;
  /** Missões feitas na semana. */
  damage: number;
  hp: number;
  defeated: boolean;
}

/**
 * Situação do chefe da semana de `weekStart` (padrão: a semana de hoje).
 * `logged` traz os hábitos registrados por data.
 */
export function weeklyBoss(
  habits: readonly Habit[],
  logged: ReadonlyMap<LocalDate, ReadonlySet<string>>,
  today: LocalDate,
  weekStart: LocalDate = startOfWeek(today),
): WeeklyBoss {
  let scheduled = 0;
  let damage = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const done = logged.get(d);
    for (const h of habits) {
      if (!isHabitScheduledOn(h, d)) continue;
      scheduled += 1;
      if (done?.has(h.id)) damage += 1;
    }
  }
  const maxHp = Math.ceil((scheduled * BOSS_PASS_PCT) / 100);
  return {
    boss: bossForWeek(weekStart),
    weekStart,
    weekEnd: addDays(weekStart, 6),
    maxHp,
    damage,
    hp: Math.max(0, maxHp - damage),
    defeated: maxHp > 0 && damage >= maxHp,
  };
}
