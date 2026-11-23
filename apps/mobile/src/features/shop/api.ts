import type { HeroClass } from '@per/domain';
import type { Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

/** Saldo de Cristais (soma do livro de Cristais do usuário, calculada no banco). */
export async function fetchCrystals(): Promise<Result<number>> {
  const { data, error } = await client().rpc('my_coin_balance');
  if (error) return { data: null, error: 'Não foi possível carregar seus Cristais.' };
  return { data: Number(data ?? 0), error: null };
}

const BUY_ERRORS: Record<string, string> = {
  PR002: 'Você já tem esta classe.',
  PR003: 'Seu nível ainda não libera esta classe.',
  PR004: 'Cristais insuficientes.',
  P0002: 'Classe não encontrada.',
  '22023': 'Esta classe já é gratuita.',
};

/** Compra uma classe: o banco confere nível, saldo e posse numa transação só. */
export async function buyClass(heroClass: HeroClass): Promise<Result<{ crystals: number }>> {
  const { data, error } = await client().rpc('buy_item', { p_item_id: heroClass });
  if (error) {
    return { data: null, error: BUY_ERRORS[error.code] ?? 'Não foi possível comprar. Verifique a internet e tente de novo.' };
  }
  return { data: { crystals: Number((data as { coin_balance: number }).coin_balance) }, error: null };
}
