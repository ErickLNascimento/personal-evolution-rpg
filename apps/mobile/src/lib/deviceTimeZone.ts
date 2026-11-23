import { getCalendars } from 'expo-localization';
import { isValidTimeZone } from '@per/domain';

/** Fuso IANA configurado no aparelho, ou `null` se a plataforma não informar um válido. */
export function deviceTimeZone(): string | null {
  const timeZone = getCalendars()[0]?.timeZone ?? null;
  return isValidTimeZone(timeZone) ? timeZone : null;
}
