import type { LocalDate } from './dates';
import { DEFAULT_LOCALE, type Locale } from './i18n';

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
export function normalizeDisplayName(
  name: string,
  locale: Locale = DEFAULT_LOCALE,
): { value: string | null; error: string | null } {
  const value = name.trim().replace(/\s+/g, ' ');
  if (value.length > DISPLAY_NAME_MAX) {
    return {
      value: null,
      error:
        locale === 'en'
          ? `The name can have at most ${DISPLAY_NAME_MAX} characters.`
          : `O nome pode ter no máximo ${DISPLAY_NAME_MAX} caracteres.`,
    };
  }
  return { value: value === '' ? null : value, error: null };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthMode = 'sign-in' | 'sign-up';

/** Mensagem de erro em português, ou `null` se os dados podem ir para o Supabase. */
const AUTH_MESSAGES = {
  'pt-BR': {
    email: 'Informe seu e-mail.',
    badEmail: 'E-mail inválido.',
    password: 'Informe sua senha.',
    short: `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`,
    mismatch: 'As senhas não conferem.',
  },
  en: {
    email: 'Enter your email.',
    badEmail: 'Invalid email.',
    password: 'Enter your password.',
    short: `The password needs at least ${PASSWORD_MIN} characters.`,
    mismatch: "The passwords don't match.",
  },
} as const;

export function validateCredentials(
  input: {
    email: string;
    password: string;
    mode: AuthMode;
  },
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const m = AUTH_MESSAGES[locale];
  const email = input.email.trim();
  if (!email) return m.email;
  if (!EMAIL_RE.test(email)) return m.badEmail;
  if (!input.password) return m.password;
  if (input.mode === 'sign-up' && input.password.length < PASSWORD_MIN) return m.short;
  return null;
}

/** A IA só pode receber dados do usuário depois do consentimento explícito. */
export function hasAiConsent(profile: { aiConsentAt: string | null }): boolean {
  return profile.aiConsentAt !== null;
}

/** Nova senha (redefinição): mesmo mínimo do cadastro e confirmação igual. */
export function validateNewPassword(
  password: string,
  confirmation: string,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (password.length < PASSWORD_MIN) return AUTH_MESSAGES[locale].short;
  if (password !== confirmation) return AUTH_MESSAGES[locale].mismatch;
  return null;
}

/** Palavra que o usuário digita para confirmar a exclusão da conta. */
export const DELETE_ACCOUNT_WORD = 'EXCLUIR';
export const DELETE_ACCOUNT_WORDS: Record<Locale, string> = { 'pt-BR': 'EXCLUIR', en: 'DELETE' };

export function isDeleteConfirmation(text: string, locale: Locale = DEFAULT_LOCALE): boolean {
  return text.trim().toUpperCase() === DELETE_ACCOUNT_WORDS[locale];
}

/** Nome do arquivo da exportação de dados (LGPD): `personal-evolution-rpg-dados-AAAA-MM-DD.json`. */
export function dataExportFileName(date: LocalDate): string {
  return `personal-evolution-rpg-dados-${date}.json`;
}
