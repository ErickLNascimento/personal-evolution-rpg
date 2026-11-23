import { resolveTimeZone, toLocalDate } from '@per/domain';
import { deviceTimeZone } from '@/lib/deviceTimeZone';
import { useProfile } from './useProfile';

/**
 * Data local de hoje no fuso salvo no perfil (a mesma que o banco usa em `user_today`).
 * Enquanto o perfil carrega, usa o fuso do aparelho.
 */
export function useToday() {
  const { profile, loading } = useProfile();
  const timeZone = profile?.timezone ?? resolveTimeZone(deviceTimeZone());
  return { today: toLocalDate(new Date(), timeZone), timeZone, ready: !loading };
}
