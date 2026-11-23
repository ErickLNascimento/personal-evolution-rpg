/**
 * Datas locais no formato ISO `YYYY-MM-DD`.
 * Toda regra de "dia" usa a data local do usuário (fuso IANA salvo no perfil),
 * nunca a data UTC do servidor.
 */
export type LocalDate = string;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Data local de um instante num fuso IANA (ex.: `America/Manaus`). */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtcMidnight(date: LocalDate): Date {
  if (!isLocalDate(date)) throw new Error(`Data local inválida: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtcMidnight(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekday(date: LocalDate): number {
  return toUtcMidnight(date).getUTCDay();
}

/** Segunda-feira da semana (semana de segunda a domingo). */
export function startOfWeek(date: LocalDate): LocalDate {
  const offset = (weekday(date) + 6) % 7;
  return addDays(date, -offset);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
