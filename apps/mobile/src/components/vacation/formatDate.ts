import type { Locale, LocalDate } from '@per/domain';

/** "26 de nov." / "Nov 26": a data local, sem fuso (meio-dia evita virar o dia). */
export function formatShortDate(date: LocalDate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(`${date}T12:00:00`),
  );
}
