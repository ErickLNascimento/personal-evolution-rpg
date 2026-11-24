import type { LocalDate } from './dates';

/**
 * Regras de conta e perfil (Sprint 1): fuso horário, nome de exibição,
 * validação de cadastro/login e consentimento da IA.
 */

/** Mesmo padrão da coluna `profiles.timezone` no banco. */
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export const DISPLAY_NAME_MAX = 60;
export const PASSWORD_MIN = 8;

/**
 * `true` se o fuso é um nome IANA reconhecido (ex.: `America/Manaus`).
 * O banco valida de novo contra `pg_timezone_names`.
 */
export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone || !timeZone.includes('/')) return timeZone === 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Fuso do aparelho quando válido; senão, o padrão do app. */
export function resolveTimeZone(candidate: string | null | undefined): string {
  return isValidTimeZone(candidate) ? candidate : DEFAULT_TIME_ZONE;
}

/** Nome sem espaços nas pontas; vazio vira `null`. Erro se passar do limite. */
export function normalizeDisplayName(name: string): { value: string | null; error: string | null } {
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length > DISPLAY_NAME_MAX) {
    return { value: null, error: `O nome pode ter no máximo ${DISPLAY_NAME_MAX} caracteres.` };
  }
  return { value: value === '' ? null : value, error: null };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthMode = 'sign-in' | 'sign-up';

/** Mensagem de erro em português, ou `null` se os dados podem ir para o Supabase. */
export function validateCredentials(input: {
  email: string;
  password: string;
  mode: AuthMode;
}): string | null {
  const email = input.email.trim();
  if (!email) return 'Informe seu e-mail.';
  if (!EMAIL_RE.test(email)) return 'E-mail inválido.';
  if (!input.password) return 'Informe sua senha.';
  if (input.mode === 'sign-up' && input.password.length < PASSWORD_MIN) {
    return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  }
  return null;
}

/** A IA só pode receber dados do usuário depois do consentimento explícito. */
export function hasAiConsent(profile: { aiConsentAt: string | null }): boolean {
  return profile.aiConsentAt !== null;
}

/** Nova senha (redefinição): mesmo mínimo do cadastro e confirmação igual. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password !== confirmation) return 'As senhas não conferem.';
  return null;
}

/** Palavra que o usuário digita para confirmar a exclusão da conta. */
export const DELETE_ACCOUNT_WORD = 'EXCLUIR';

export function isDeleteConfirmation(text: string): boolean {
  return text.trim().toUpperCase() === DELETE_ACCOUNT_WORD;
}

/** Nome do arquivo da exportação de dados (LGPD): `personal-evolution-rpg-dados-AAAA-MM-DD.json`. */
export function dataExportFileName(date: LocalDate): string {
  return `personal-evolution-rpg-dados-${date}.json`;
}
