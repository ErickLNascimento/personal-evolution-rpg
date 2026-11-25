/**
 * Recompensas personalizadas: o usuário cria os próprios prêmios da vida real
 * ("ver um episódio = 50 Cristais") e os resgata com Cristais. Espelha `custom_rewards`.
 */
import { REWARD_SUGGESTIONS_EN } from './contentEn';
import { DEFAULT_LOCALE, type Locale } from './i18n';

export const REWARD_TITLE_MAX = 60;
export const REWARD_PRICE_MIN = 5;
export const REWARD_PRICE_MAX = 5000;
export const REWARD_EMOJI_MAX = 8;

/** Sugestões para quem ainda não criou nenhuma recompensa. */
export const REWARD_SUGGESTIONS: readonly { emoji: string; title: string; price: number }[] = [
  { emoji: '🎬', title: 'Ver um episódio da minha série', price: 50 },
  { emoji: '🍫', title: 'Um doce sem culpa', price: 40 },
  { emoji: '🎮', title: '1 hora de videogame', price: 80 },
  { emoji: '🍕', title: 'Pedir comida no fim de semana', price: 200 },
];

export interface RewardInput {
  title: string;
  price: number;
  emoji?: string | null;
}

/** Mensagem de erro em português, ou null se a recompensa pode ser salva. */
export function validateReward(input: RewardInput): string | null {
  const title = input.title.trim();
  if (title.length === 0) return 'Dê um nome para a recompensa.';
  if (title.length > REWARD_TITLE_MAX)
    return `Use no máximo ${REWARD_TITLE_MAX} caracteres no nome.`;
  if (
    !Number.isInteger(input.price) ||
    input.price < REWARD_PRICE_MIN ||
    input.price > REWARD_PRICE_MAX
  )
    return `O preço vai de ${REWARD_PRICE_MIN} a ${REWARD_PRICE_MAX} Cristais.`;
  if (input.emoji && [...input.emoji].length > REWARD_EMOJI_MAX) return 'Use só um emoji.';
  return null;
}

/** Quantas vezes dá para resgatar com o saldo atual (0 = ainda não dá). */
export function affordable(price: number, balance: number): number {
  return price > 0 ? Math.max(0, Math.floor(balance / price)) : 0;
}

/** Sugestões de recompensa no idioma. */
export function rewardSuggestions(
  locale: Locale = DEFAULT_LOCALE,
): readonly { emoji: string; title: string; price: number }[] {
  if (locale !== 'en') return REWARD_SUGGESTIONS;
  return REWARD_SUGGESTIONS.map((s, i) => ({ ...s, title: REWARD_SUGGESTIONS_EN[i] ?? s.title }));
}
