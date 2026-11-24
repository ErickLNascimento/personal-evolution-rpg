import type { AuthError } from '@supabase/supabase-js';
import { t, type TKey } from '@/i18n';

const MESSAGES: Record<string, TKey> = {
  invalid_credentials: 'auth.errInvalid',
  email_not_confirmed: 'auth.errNotConfirmed',
  user_already_exists: 'auth.errExists',
  email_exists: 'auth.errExists',
  weak_password: 'auth.errWeak',
  over_email_send_rate_limit: 'auth.errRate',
  over_request_rate_limit: 'auth.errRate',
  signup_disabled: 'auth.errSignupOff',
};

/** Mensagem em português para erros do Supabase Auth. */
export function authErrorMessage(error: AuthError | Error): string {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  if (code && MESSAGES[code]) return t(MESSAGES[code]);
  if (/network|fetch/i.test(error.message)) return t('common.noConnection');
  return t('auth.errGeneric');
}
