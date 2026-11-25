import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

/** Exclui a conta e todos os dados (Edge Function delete-account). Devolve erro em português ou `null`. */
export async function deleteAccount(confirm: string): Promise<string | null> {
  if (!supabase) return t('deleteAccount.notConfigured');
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (body && typeof body.error === 'string') return body.error;
    }
    return t('deleteAccount.failed');
  }
  // A conta já não existe: limpa a sessão local e o _layout volta para o login.
  await supabase.auth.signOut({ scope: 'local' });
  return null;
}
