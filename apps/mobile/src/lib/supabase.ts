import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** `true` quando o `.env.local` foi preenchido com o projeto Supabase de desenvolvimento. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Cliente Supabase do app. Só a URL e a anon key ficam no app;
 * a segurança vem do RLS no banco. Fica `null` até o `.env.local` ser configurado.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Renova o token só com o app em primeiro plano (recomendação do Supabase para React Native).
if (supabase) {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}

/**
 * Cliente separado e sem persistência para o link de redefinição de senha.
 * Assim a sessão de recuperação não troca o login do app nem a navegação.
 */
export function createRecoveryClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
