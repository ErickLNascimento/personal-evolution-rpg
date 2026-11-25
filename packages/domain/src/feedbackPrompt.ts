/**
 * Pedido de feedback (pop-up com nota de 1 a 5). Aparece só em momentos bons e com parcimônia:
 *   · depois de um tempo de uso (dias desde o primeiro registro) e de um mínimo de missões feitas;
 *   · logo após um momento positivo: dia perfeito, subir de nível ou derrotar o chefe;
 *   · no máximo uma vez a cada `cooldownDays`;
 *   · nunca mais depois de enviar uma nota, de "Não perguntar mais" ou de `maxDismissals` "Agora não".
 * Os números vêm de app_settings (a equipe ajusta sem publicar versão); ver feedbackPromptConfig.
 */
import { addDays, compareLocalDates, type LocalDate } from './dates';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export type FeedbackMoment = 'perfect_day' | 'level_up' | 'boss_defeated';

export interface FeedbackPromptConfig {
  minDays: number;
  minMissions: number;
  cooldownDays: number;
  maxDismissals: number;
}

export const FEEDBACK_PROMPT_DEFAULTS: FeedbackPromptConfig = {
  minDays: 5,
  minMissions: 15,
  cooldownDays: 30,
  maxDismissals: 3,
};

/** Chaves em app_settings que ajustam as regras (ausentes = padrão). */
export const FEEDBACK_PROMPT_SETTINGS: Record<keyof FeedbackPromptConfig, string> = {
  minDays: 'feedback_prompt_min_days',
  minMissions: 'feedback_prompt_min_missions',
  cooldownDays: 'feedback_prompt_cooldown_days',
  maxDismissals: 'feedback_prompt_max_dismissals',
};

/** Regras a partir de app_settings; valores ausentes ou inválidos ficam no padrão. */
export function feedbackPromptConfig(settings: ReadonlyMap<string, number>): FeedbackPromptConfig {
  const out = { ...FEEDBACK_PROMPT_DEFAULTS };
  for (const key of Object.keys(FEEDBACK_PROMPT_SETTINGS) as (keyof FeedbackPromptConfig)[]) {
    const v = settings.get(FEEDBACK_PROMPT_SETTINGS[key]);
    if (v !== undefined && Number.isFinite(v) && v >= 0) out[key] = Math.floor(v);
  }
  return out;
}

/** O que o aparelho lembra dos pedidos anteriores. */
export interface FeedbackPromptMemory {
  /** Último dia em que o pop-up apareceu. */
  lastShown: LocalDate | null;
  /** Quantas vezes tocou em "Agora não". */
  dismissals: number;
  /** Enviou uma nota ou pediu para não perguntar mais. */
  done: boolean;
}

export const EMPTY_FEEDBACK_MEMORY: FeedbackPromptMemory = {
  lastShown: null,
  dismissals: 0,
  done: false,
};

export interface FeedbackUsage {
  /** Primeiro dia com missão registrada (null = nenhuma ainda). */
  firstLogDate: LocalDate | null;
  /** Missões registradas no total. */
  missionsDone: number;
  /** Já existe uma nota enviada por este pop-up (em qualquer aparelho). */
  alreadyRated: boolean;
}

export function shouldPromptFeedback(
  memory: FeedbackPromptMemory,
  usage: FeedbackUsage,
  config: FeedbackPromptConfig,
  today: LocalDate,
): boolean {
  if (memory.done || usage.alreadyRated) return false;
  if (memory.dismissals >= config.maxDismissals) return false;
  if (!usage.firstLogDate) return false;
  if (compareLocalDates(addDays(usage.firstLogDate, config.minDays), today) > 0) return false;
  if (usage.missionsDone < config.minMissions) return false;
  if (memory.lastShown && compareLocalDates(addDays(memory.lastShown, config.cooldownDays), today) > 0)
    return false;
  return true;
}

/** Memória depois de uma resposta ao pop-up. */
export function afterFeedbackPrompt(
  memory: FeedbackPromptMemory,
  answer: 'sent' | 'later' | 'never',
  today: LocalDate,
): FeedbackPromptMemory {
  if (answer === 'later') return { ...memory, lastShown: today, dismissals: memory.dismissals + 1 };
  return { ...memory, lastShown: today, done: true };
}

/** Lê a memória guardada (JSON livre); qualquer coisa estranha volta ao vazio. */
export function parseFeedbackMemory(raw: string | null | undefined): FeedbackPromptMemory {
  if (!raw) return EMPTY_FEEDBACK_MEMORY;
  try {
    const o = JSON.parse(raw) as Partial<FeedbackPromptMemory>;
    return {
      lastShown: typeof o.lastShown === 'string' ? o.lastShown : null,
      dismissals: Number.isInteger(o.dismissals) && o.dismissals! > 0 ? o.dismissals! : 0,
      done: o.done === true,
    };
  } catch {
    return EMPTY_FEEDBACK_MEMORY;
  }
}

/** Nota baixa: o pop-up pergunta o que melhorar. */
export function isLowRating(rating: number): boolean {
  return rating <= 2;
}

export const FEEDBACK_RATING_MESSAGE_MAX = 1000;

/** Confere nota e comentário do pop-up; devolve a mensagem de erro ou null. */
export function validateFeedbackRating(
  rating: number,
  message: string,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  const en = locale === 'en';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return en ? 'Pick a rating from 1 to 5.' : 'Escolha uma nota de 1 a 5.';
  if (message.trim().length > FEEDBACK_RATING_MESSAGE_MAX)
    return en
      ? `Use at most ${FEEDBACK_RATING_MESSAGE_MAX} characters.`
      : `Use no máximo ${FEEDBACK_RATING_MESSAGE_MAX} caracteres.`;
  return null;
}
