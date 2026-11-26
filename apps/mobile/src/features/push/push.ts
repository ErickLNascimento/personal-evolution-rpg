import type { PushCategory } from '@per/domain';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { Result } from '@/features/habits/api';
import { currentLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Push de verdade (docs/push/README.md): registra este aparelho no servidor para receber avisos
 * com o app fechado. Só pede permissão quando a pessoa liga os avisos (Perfil ou cartão na tela
 * Hoje); depois disso, reafirma o registro ao abrir o app.
 */

/** Canais do Android, um por categoria (o servidor manda o channelId). */
const CHANNELS: Record<PushCategory, () => string> = {
  social: () => t('push.channelSocial'),
  bosses: () => t('push.channelBosses'),
  reengage: () => t('push.channelReengage'),
};

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  for (const [id, name] of Object.entries(CHANNELS)) {
    await Notifications.setNotificationChannelAsync(id, {
      name: name(),
      importance: id === 'social' ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
    });
  }
}

let lastToken: string | null = null;

/** Token Expo deste aparelho, ou null (sem permissão, sem Firebase no build, simulador…). */
async function deviceToken(): Promise<string | null> {
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    // Build sem google-services.json (antes do APK com Firebase) cai aqui: segue sem push.
    if (__DEV__) console.warn('[push] sem token', String(e));
    return null;
  }
}

/** Registra o aparelho se já houver permissão. `true` se ficou registrado. */
export async function registerIfAllowed(): Promise<boolean> {
  if (!supabase || Platform.OS === 'web') return false;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return false;
  await ensureChannels();
  const token = await deviceToken();
  if (!token) return false;
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_locale: currentLocale() === 'en' ? 'en' : 'pt-BR',
  });
  if (error) return false;
  lastToken = token;
  return true;
}

/** Pede a permissão (se ainda dá) e registra. `true` se os avisos ficaram ligados. */
export async function enablePush(): Promise<boolean> {
  await ensureChannels();
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    if (!asked.granted) return false;
  }
  return registerIfAllowed();
}

/** Antes de sair da conta: este aparelho para de receber os avisos dela. */
export async function unregisterPush(): Promise<void> {
  if (!supabase || !lastToken) return;
  await supabase.rpc('unregister_push_token', { p_token: lastToken });
  lastToken = null;
}

/** Já dá para pedir a permissão (ainda não decidida)? Para o cartão da tela Hoje. */
export async function canAskPush(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const p = await Notifications.getPermissionsAsync();
  return !p.granted && p.canAskAgain;
}

/** Com a flag ligada e a conta pronta: reafirma o registro ao abrir e ao voltar para o app. */
export function usePushRegistration(userId: string | null, enabled: boolean) {
  useEffect(() => {
    if (!userId || !enabled) return;
    void registerIfAllowed().catch(() => false);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void registerIfAllowed().catch(() => false);
    });
    return () => sub.remove();
  }, [userId, enabled]);
}

export interface PushSettings {
  social: boolean;
  bosses: boolean;
  reengage: boolean;
}

export async function fetchPushSettings(): Promise<Result<PushSettings>> {
  if (!supabase) return { data: { social: true, bosses: true, reengage: true }, error: null };
  const { data, error } = await supabase.from('push_settings').select('social, bosses, reengage').maybeSingle();
  if (error) return { data: null, error: t('push.errorLoad') };
  return { data: data ?? { social: true, bosses: true, reengage: true }, error: null };
}

export async function savePushSettings(s: PushSettings): Promise<Result<true>> {
  if (!supabase) return { data: true, error: null };
  const { error } = await supabase.rpc('set_push_settings', {
    p_social: s.social,
    p_bosses: s.bosses,
    p_reengage: s.reengage,
  });
  if (error) return { data: null, error: t('push.errorSave') };
  return { data: true, error: null };
}
