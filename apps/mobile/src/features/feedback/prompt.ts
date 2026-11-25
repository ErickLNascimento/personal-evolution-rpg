import {
  parseFeedbackMemory,
  type FeedbackPromptMemory,
  type FeedbackUsage,
} from '@per/domain';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Pedido de feedback: o uso vem do banco (my_feedback_prompt_usage); o que o aparelho lembra dos
 * pedidos (último, "Agora não", não perguntar mais) fica no localStorage, por usuário.
 */
const memoryKey = (userId: string) => `per.feedbackPrompt.${userId}`;

export function loadFeedbackMemory(userId: string): FeedbackPromptMemory {
  return parseFeedbackMemory(globalThis.localStorage?.getItem(memoryKey(userId)));
}

export function saveFeedbackMemory(userId: string, memory: FeedbackPromptMemory): void {
  globalThis.localStorage?.setItem(memoryKey(userId), JSON.stringify(memory));
}

/** Uso para as regras; null se não deu para ler (aí o pop-up simplesmente não aparece). */
export async function fetchFeedbackUsage(): Promise<FeedbackUsage | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_feedback_prompt_usage');
  if (error || !data) return null;
  const d = data as { first_log_date: string | null; missions_done: number; already_rated: boolean };
  return {
    firstLogDate: d.first_log_date,
    missionsDone: Number(d.missions_done ?? 0),
    alreadyRated: d.already_rated === true,
  };
}

/** Envia a nota (1 a 5) e o comentário opcional. Mensagem de erro, ou null se deu certo. */
export async function submitFeedbackRating(rating: number, message: string): Promise<string | null> {
  if (!supabase) return t('deleteAccount.notConfigured');
  const platform =
    Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : null;
  const { error } = await supabase.rpc('submit_feedback_rating', {
    p_rating: rating,
    p_message: message.trim() || null,
    p_app_version: Constants.expoConfig?.version ?? null,
    p_platform: platform,
  });
  if (!error) return null;
  if (/network|fetch/i.test(error.message)) return t('common.noConnection');
  return t('feedback.failed');
}
