import type { AuthError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  weak_password: 'Senha fraca. Use uma senha mais longa e menos óbvia.',
  over_email_send_rate_limit: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  signup_disabled: 'Novos cadastros estão desativados no momento.',
};

/** Mensagem em português para erros do Supabase Auth. */
export function authErrorMessage(error: AuthError | Error): string {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (/network|fetch/i.test(error.message)) return 'Sem conexão. Verifique a internet e tente de novo.';
  return 'Não foi possível concluir. Tente de novo.';
}
