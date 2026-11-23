import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Exclui a conta e todos os dados (Edge Function delete-account). Devolve erro em português ou `null`. */
export async function deleteAccount(confirm: string): Promise<string | null> {
  if (!supabase) return 'Supabase não configurado.';
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await (error.context as Response).json().catch(() => null);
      if (body && typeof body.error === 'string') return body.error;
    }
    return 'Não foi possível excluir a conta. Verifique a internet e tente de novo.';
  }
  // A conta já não existe: limpa a sessão local e o _layout volta para o login.
  await supabase.auth.signOut({ scope: 'local' });
  return null;
}
