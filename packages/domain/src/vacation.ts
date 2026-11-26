/**
 * Modo férias (espelha 20261127000100_vacation_mode.sql). Em dias de férias nenhum hábito fica
 * agendado: as missões somem, o dia não conta nem quebra o streak, e chefe e jornadas ignoram o
 * dia. Quem grava é o banco (start_vacation / end_vacation); aqui ficam as regras para a tela.
 */
import { addDays, compareLocalDates, type LocalDate } from './dates';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export interface Vacation {
  id: string;
  startDate: LocalDate;
  /** Último dia de férias (inclusivo). */
  endDate: LocalDate;
}

/** Dias de um mesmo período, no máximo (igual ao banco). */
export const VACATION_MAX_DAYS = 14;
/** Dias de férias por ano civil, somando os períodos (igual ao banco). */
export const VACATION_DAYS_PER_YEAR = 30;
/** Até quantos dias à frente dá para marcar o início. */
export const VACATION_MAX_LEAD_DAYS = 60;

export function vacationLength(v: Pick<Vacation, 'startDate' | 'endDate'>): number {
  let n = 0;
  for (let d = v.startDate; compareLocalDates(d, v.endDate) <= 0; d = addDays(d, 1)) n += 1;
  return n;
}

export function isOnVacation(vacations: readonly Vacation[] | undefined, date: LocalDate): boolean {
  if (!vacations) return false;
  return vacations.some(
    (v) => compareLocalDates(date, v.startDate) >= 0 && compareLocalDates(date, v.endDate) <= 0,
  );
}

/** Dias de férias que caem no ano `year` (períodos podem atravessar a virada do ano). */
export function vacationDaysInYear(vacations: readonly Vacation[], year: number): number {
  let n = 0;
  for (const v of vacations)
    for (let d = v.startDate; compareLocalDates(d, v.endDate) <= 0; d = addDays(d, 1))
      if (Number(d.slice(0, 4)) === year) n += 1;
  return n;
}

/** Férias de hoje, ou a próxima marcada; null se não há nenhuma pela frente. */
export function currentOrNextVacation(
  vacations: readonly Vacation[],
  today: LocalDate,
): Vacation | null {
  const ahead = vacations
    .filter((v) => compareLocalDates(v.endDate, today) >= 0)
    .sort((a, b) => compareLocalDates(a.startDate, b.startDate));
  return ahead[0] ?? null;
}

/**
 * Confere um período novo; devolve a mensagem de erro ou null. Mesmas regras de start_vacation:
 * começa hoje ou depois (até VACATION_MAX_LEAD_DAYS), dura de 1 a VACATION_MAX_DAYS dias, não se
 * sobrepõe a outro período e não passa de VACATION_DAYS_PER_YEAR dias em cada ano.
 */
export function validateVacation(
  startDate: LocalDate,
  days: number,
  today: LocalDate,
  existing: readonly Vacation[],
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const en = locale === 'en';
  if (compareLocalDates(startDate, today) < 0)
    return en ? 'Vacation must start today or later.' : 'As férias começam hoje ou depois.';
  if (compareLocalDates(startDate, addDays(today, VACATION_MAX_LEAD_DAYS)) > 0)
    return en
      ? `Schedule at most ${VACATION_MAX_LEAD_DAYS} days ahead.`
      : `Marque com no máximo ${VACATION_MAX_LEAD_DAYS} dias de antecedência.`;
  if (!Number.isInteger(days) || days < 1 || days > VACATION_MAX_DAYS)
    return en
      ? `A vacation lasts from 1 to ${VACATION_MAX_DAYS} days.`
      : `As férias duram de 1 a ${VACATION_MAX_DAYS} dias.`;
  const next: Vacation = { id: 'new', startDate, endDate: addDays(startDate, days - 1) };
  const overlaps = existing.some(
    (v) =>
      compareLocalDates(next.startDate, v.endDate) <= 0 &&
      compareLocalDates(v.startDate, next.endDate) <= 0,
  );
  if (overlaps)
    return en ? 'These dates overlap another vacation.' : 'Essas datas cruzam outras férias.';
  const years = new Set([Number(next.startDate.slice(0, 4)), Number(next.endDate.slice(0, 4))]);
  for (const year of years) {
    if (vacationDaysInYear([...existing, next], year) > VACATION_DAYS_PER_YEAR)
      return en
        ? `That goes over ${VACATION_DAYS_PER_YEAR} vacation days in ${year}.`
        : `Passa de ${VACATION_DAYS_PER_YEAR} dias de férias em ${year}.`;
  }
  return null;
}

/**
 * O que "encerrar" faz (igual a end_vacation): férias que ainda não começaram (ou começam hoje)
 * são apagadas; as em andamento terminam ontem, e hoje as missões voltam.
 */
export function endVacationEffect(
  v: Vacation,
  today: LocalDate,
): { kind: 'delete' } | { kind: 'shorten'; endDate: LocalDate } | { kind: 'none' } {
  if (compareLocalDates(v.endDate, today) < 0) return { kind: 'none' };
  if (compareLocalDates(v.startDate, today) >= 0) return { kind: 'delete' };
  return { kind: 'shorten', endDate: addDays(today, -1) };
}

/** Os hábitos passam a carregar as férias do usuário: isHabitScheduledOn respeita os períodos. */
export function withVacations<H extends { vacations?: readonly Vacation[] }>(
  habits: readonly H[],
  vacations: readonly Vacation[],
): H[] {
  return habits.map((h) => ({ ...h, vacations }));
}
