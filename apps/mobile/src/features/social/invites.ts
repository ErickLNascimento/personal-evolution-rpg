import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { fetchIncomingRequests, type FriendRequest } from '@/features/social/api';
import { supabase } from '@/lib/supabase';

/**
 * Convites de amizade recebidos, compartilhados entre a barra de abas (contador na Fogueira) e
 * a tela Hoje (cartão). Recarrega ao abrir o app, ao voltar para ele e quando alguém chama
 * refreshInvites (ex.: depois de aceitar na Fogueira).
 */
interface InvitesState {
  requests: readonly FriendRequest[];
  postponed: ReadonlySet<string>;
}

const EMPTY: InvitesState = { requests: [], postponed: new Set() };
let state: InvitesState = EMPTY;
let userKey: string | null = null;
const listeners = new Set<() => void>();

function emit(next: InvitesState) {
  state = next;
  for (const l of listeners) l();
}

const postponedKey = (userId: string) => `friend-invites-postponed:${userId}`;

function readPostponed(userId: string): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(postponedKey(userId));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

let inFlight = false;

/** Busca de novo os convites (sem erro na tela: se falhar, mantém o que já havia). */
export async function refreshInvites(): Promise<void> {
  if (!supabase || !userKey || inFlight) return;
  inFlight = true;
  const user = userKey;
  const r = await fetchIncomingRequests();
  inFlight = false;
  if (r.error !== null || user !== userKey) return;
  // Esquece adiamentos de convites que já não existem.
  const ids = new Set(r.data.map((x) => x.requestId));
  const postponed = new Set([...state.postponed].filter((id) => ids.has(id)));
  if (postponed.size !== state.postponed.size)
    globalThis.localStorage?.setItem(postponedKey(user), JSON.stringify([...postponed]));
  emit({ requests: r.data, postponed });
}

/** "Depois": tira o convite da tela Hoje; o contador da Fogueira continua. */
export function postponeInvite(requestId: string): void {
  if (!userKey) return;
  const postponed = new Set(state.postponed).add(requestId);
  globalThis.localStorage?.setItem(postponedKey(userKey), JSON.stringify([...postponed]));
  emit({ ...state, postponed });
}

/** Tira o convite da lista na hora (depois de aceitar ou recusar), antes do próximo refresh. */
export function dropInvite(requestId: string): void {
  emit({ ...state, requests: state.requests.filter((r) => r.requestId !== requestId) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Convites do usuário logado. Com `enabled` falso (flag desligada ou sem login), lista vazia.
 * Montado uma vez na barra de abas; a tela Hoje só lê.
 */
export function useInvites(userId: string | null, enabled: boolean): InvitesState {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const on = enabled && userId !== null;
  useEffect(() => {
    if (!on || !userId) {
      userKey = null;
      emit(EMPTY);
      return;
    }
    if (userKey !== userId) {
      userKey = userId;
      emit({ requests: [], postponed: readPostponed(userId) });
    }
    void refreshInvites();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refreshInvites();
    });
    return () => sub.remove();
  }, [on, userId]);
  return on ? snapshot : EMPTY;
}

/** Só leitura do estado (para telas que não controlam o carregamento). */
export function useInvitesState(): InvitesState {
  return useSyncExternalStore(subscribe, () => state);
}
