import type { FeedbackKind } from '@per/domain';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

/** Envia um feedback. Devolve uma mensagem de erro em português, ou null se deu certo. */
export async function sendFeedback(kind: FeedbackKind, message: string): Promise<string | null> {
  if (!supabase) return t('deleteAccount.notConfigured');
  const platform =
    Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web'
      ? Platform.OS
      : null;
  const { error } = await supabase.from('feedback').insert({
    kind,
    message: message.trim(),
    app_version: Constants.expoConfig?.version ?? null,
    platform,
  });
  if (!error) return null;
  if (/network|fetch/i.test(error.message)) return t('common.noConnection');
  return t('feedback.failed');
}
