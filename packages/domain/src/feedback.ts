import { DEFAULT_LOCALE, type Locale } from './i18n';

/** Feedback enviado pelo app (espelha a tabela `feedback`). */
export const FEEDBACK_KINDS = ['bug', 'ideia', 'elogio', 'outro'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  bug: 'Problema',
  ideia: 'Ideia',
  elogio: 'Elogio',
  outro: 'Outro',
};

export const FEEDBACK_MIN = 3;
export const FEEDBACK_MAX = 2000;

/** Mensagem de erro em português, ou null se o texto pode ser enviado. */
export function validateFeedback(message: string, locale: Locale = DEFAULT_LOCALE): string | null {
  const text = message.trim();
  if (text.length < FEEDBACK_MIN)
    return locale === 'en'
      ? 'Write a bit more about what happened or what you suggest.'
      : 'Escreva um pouco mais sobre o que aconteceu ou o que você sugere.';
  if (text.length > FEEDBACK_MAX) return `Use no máximo ${FEEDBACK_MAX} caracteres.`;
  return null;
}
