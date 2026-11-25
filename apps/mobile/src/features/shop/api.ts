import type { PostgrestError } from '@supabase/supabase-js';
import type { Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

export interface CustomReward {
  id: string;
  title: string;
  emoji: string | null;
  price: number;
}

export interface Redemption {
  id: string;
  title: string;
  emoji: string | null;
  price: number;
  redeemedAt: string;
}

export interface ShopData {
  crystals: number;
  rewards: CustomReward[];
  redemptions: Redemption[];
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  if (error.code === 'PR004') return { data: null, error: t('shop.errorCrystals') };
  if (error.code === 'PR002') return { data: null, error: t('shop.errorOwned') };
  if (error.code === '23514') return { data: null, error: t('shop.errorReward') };
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
  return { data: null, error: fallback };
}

/** Saldo, recompensas personalizadas e os últimos resgates. */
export async function fetchShop(): Promise<Result<ShopData>> {
  const db = client();
  const [balance, rewards, redemptions] = await Promise.all([
    db.rpc('my_coin_balance'),
    db
      .from('custom_rewards')
      .select('id, title, emoji, price')
      .order('created_at')
      .returns<CustomReward[]>(),
    db
      .from('reward_redemptions')
      .select('id, title, emoji, price, redeemed_at')
      .order('redeemed_at', { ascending: false })
      .limit(10)
      .returns<
        { id: string; title: string; emoji: string | null; price: number; redeemed_at: string }[]
      >(),
  ]);
  if (balance.error) return failure(balance.error, t('apiErrors.loadShop'));
  if (rewards.error) return failure(rewards.error, t('apiErrors.loadRewards'));
  return {
    data: {
      crystals: Number(balance.data ?? 0),
      rewards: rewards.data ?? [],
      redemptions: (redemptions.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        emoji: r.emoji,
        price: r.price,
        redeemedAt: r.redeemed_at,
      })),
    },
    error: null,
  };
}

export async function buyCosmetic(itemId: string): Promise<Result<number>> {
  const { data, error } = await client().rpc('buy_cosmetic', { p_item_id: itemId });
  if (error) return failure(error, t('shop.errorBuy'));
  return { data: (data as { coin_balance: number }).coin_balance, error: null };
}

export async function saveReward(
  reward: { title: string; emoji: string | null; price: number },
  id?: string,
): Promise<Result<true>> {
  const row = {
    title: reward.title.trim(),
    emoji: reward.emoji?.trim() || null,
    price: reward.price,
  };
  const { error } = id
    ? await client().from('custom_rewards').update(row).eq('id', id)
    : await client().from('custom_rewards').insert(row);
  if (error) return failure(error, t('shop.errorSaveReward'));
  return { data: true, error: null };
}

export async function deleteReward(id: string): Promise<Result<true>> {
  const { error } = await client().from('custom_rewards').delete().eq('id', id);
  if (error) return failure(error, t('shop.errorDeleteReward'));
  return { data: true, error: null };
}

/** Resgata uma recompensa: o banco confere o saldo e desconta os Cristais. */
export async function redeemReward(id: string): Promise<Result<number>> {
  const { data, error } = await client().rpc('redeem_reward', { p_reward_id: id });
  if (error) return failure(error, t('shop.errorRedeem'));
  return { data: (data as { coin_balance: number }).coin_balance, error: null };
}
