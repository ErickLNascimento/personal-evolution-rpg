import type { PostgrestError } from '@supabase/supabase-js';
import {
  heroLook,
  isPathId,
  isRace,
  type Branch,
  type HeroLook,
  type LocalDate,
  type PathId,
  type Tier,
} from '@per/domain';
import type { Result } from '@/features/habits/api';
import { supabase } from '@/lib/supabase';

/** Cartão curto (busca e pedidos): nome, nível e aparência. */
export interface SocialCard {
  userId: string;
  displayName: string | null;
  level: number;
  hero: HeroLook;
}

/** Resumo de um amigo ou colega de grupo (nunca traz nomes de hábitos). */
export interface SocialSummary extends SocialCard {
  streak: number;
  todayDone: number;
  todayTotal: number;
}

export interface FriendRequest {
  requestId: string;
  user: SocialCard;
}

export interface FriendsData {
  friends: SocialSummary[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export interface MySocial {
  friendCode: string;
  discoverable: boolean;
}

export type Relation = 'friend' | 'pending_out' | 'pending_in' | null;

export interface GroupBossNumbers {
  maxHp: number;
  damage: number;
  claimed: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  memberCount: number;
  weekStart: LocalDate;
  boss: GroupBossNumbers;
  lastBoss: GroupBossNumbers;
  members: SocialSummary[] | null;
}

function client() {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}

const MESSAGES: Record<string, string> = {
  P0002: 'Não encontrado. Confira o código.',
  PR040: 'Este é o seu próprio código.',
  PR041: 'Vocês já são amigos.',
  PR042: 'Você chegou ao limite de amigos ou de pedidos pendentes.',
  PR043: 'Você já está em 5 grupos.',
  PR044: 'Este grupo já tem 6 pessoas.',
  PR032: 'O chefe ainda não foi derrotado.',
};

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  const known = error.code ? MESSAGES[error.code] : undefined;
  if (known) return { data: null, error: known };
  // Banco ainda sem a migration do social.
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42703')
    return { data: null, error: 'O social ainda não está disponível. Tente mais tarde.' };
  if (/network|fetch/i.test(error.message))
    return { data: null, error: 'Sem conexão. Verifique a internet e tente de novo.' };
  return { data: null, error: fallback };
}

interface CardRow {
  user_id: string;
  display_name: string | null;
  hero: unknown;
  race: string;
  path: string | null;
  branch: string | null;
  stage: number;
  cosmetics: string[] | null;
  level: number;
  streak?: number;
  today_done?: number;
  today_total?: number;
}

function toCard(row: CardRow): SocialCard {
  const level = Number(row.level ?? 1);
  return {
    userId: row.user_id,
    displayName: row.display_name,
    level,
    hero: heroLook(
      row.hero,
      level,
      {
        path: isPathId(row.path) ? (row.path as PathId) : null,
        branch: row.branch === 'A' || row.branch === 'B' ? (row.branch as Branch) : null,
        stage: Math.max(0, Math.min(5, row.stage ?? 0)) as Tier,
      },
      isRace(row.race) ? row.race : 'humano',
      new Set(row.cosmetics ?? []),
    ),
  };
}

function toSummary(row: CardRow): SocialSummary {
  return {
    ...toCard(row),
    streak: Number(row.streak ?? 0),
    todayDone: Number(row.today_done ?? 0),
    todayTotal: Number(row.today_total ?? 0),
  };
}

/** Código de amigo e se aparece na busca (lido à parte para o perfil não depender do social). */
export async function fetchMySocial(userId: string): Promise<Result<MySocial>> {
  const { data, error } = await client()
    .from('profiles')
    .select('friend_code, discoverable')
    .eq('id', userId)
    .single<{ friend_code: string; discoverable: boolean }>();
  if (error) return failure(error, 'Não foi possível carregar o seu código.');
  return { data: { friendCode: data.friend_code, discoverable: data.discoverable }, error: null };
}

export async function setDiscoverable(userId: string, on: boolean): Promise<Result<true>> {
  const { error } = await client().from('profiles').update({ discoverable: on }).eq('id', userId);
  if (error) return failure(error, 'Não foi possível salvar.');
  return { data: true, error: null };
}

export async function fetchFriends(): Promise<Result<FriendsData>> {
  const { data, error } = await client().rpc('my_friends');
  if (error) return failure(error, 'Não foi possível carregar os amigos.');
  const r = data as {
    friends: CardRow[];
    incoming: { request_id: string; user: CardRow }[];
    outgoing: { request_id: string; user: CardRow }[];
  };
  return {
    data: {
      friends: r.friends.map(toSummary),
      incoming: r.incoming.map((i) => ({ requestId: i.request_id, user: toCard(i.user) })),
      outgoing: r.outgoing.map((i) => ({ requestId: i.request_id, user: toCard(i.user) })),
    },
    error: null,
  };
}

export async function sendFriendRequest(
  target: { code: string } | { userId: string },
): Promise<Result<{ status: 'pending' | 'accepted'; user: SocialCard }>> {
  const args = 'code' in target ? { p_code: target.code } : { p_user: target.userId };
  const { data, error } = await client().rpc('send_friend_request', args);
  if (error) return failure(error, 'Não foi possível enviar o pedido.');
  const r = data as { status: 'pending' | 'accepted'; user: CardRow };
  return { data: { status: r.status, user: toCard(r.user) }, error: null };
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<Result<true>> {
  const { error } = await client().rpc('respond_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return failure(error, 'Não foi possível responder ao pedido.');
  return { data: true, error: null };
}

/** Desfaz a amizade ou cancela um pedido. */
export async function removeFriend(userId: string): Promise<Result<true>> {
  const { error } = await client().rpc('remove_friend', { p_user: userId });
  if (error) return failure(error, 'Não foi possível remover.');
  return { data: true, error: null };
}

export async function searchUsers(
  query: string,
): Promise<Result<{ user: SocialCard; relation: Relation }[]>> {
  const { data, error } = await client().rpc('search_users', { p_query: query });
  if (error) return failure(error, 'Não foi possível buscar.');
  const rows = data as { user: CardRow; relation: Relation }[];
  return { data: rows.map((r) => ({ user: toCard(r.user), relation: r.relation })), error: null };
}

interface BossRow {
  max_hp: number;
  damage: number;
  claimed: boolean;
}

interface GroupRow {
  id: string;
  name: string;
  invite_code: string;
  is_owner: boolean;
  member_count: number;
  week_start: string;
  boss: BossRow;
  last_boss: BossRow;
  members: CardRow[] | null;
}

function toBoss(b: BossRow): GroupBossNumbers {
  return { maxHp: Number(b.max_hp), damage: Number(b.damage), claimed: Boolean(b.claimed) };
}

function toGroup(row: GroupRow): GroupInfo {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    isOwner: row.is_owner,
    memberCount: Number(row.member_count),
    weekStart: row.week_start,
    boss: toBoss(row.boss),
    lastBoss: toBoss(row.last_boss),
    members: row.members ? row.members.map(toSummary) : null,
  };
}

export async function fetchGroups(): Promise<Result<GroupInfo[]>> {
  const { data, error } = await client().rpc('my_groups');
  if (error) return failure(error, 'Não foi possível carregar os grupos.');
  return { data: (data as GroupRow[]).map(toGroup), error: null };
}

export async function fetchGroup(id: string): Promise<Result<GroupInfo>> {
  const { data, error } = await client().rpc('group_detail', { p_group: id });
  if (error) return failure(error, 'Não foi possível carregar o grupo.');
  return { data: toGroup(data as GroupRow), error: null };
}

export async function createGroup(name: string): Promise<Result<string>> {
  const { data, error } = await client().rpc('create_group', { p_name: name });
  if (error) return failure(error, 'Não foi possível criar o grupo.');
  return { data: (data as { id: string }).id, error: null };
}

export async function joinGroup(code: string): Promise<Result<string>> {
  const { data, error } = await client().rpc('join_group', { p_code: code });
  if (error) return failure(error, 'Não foi possível entrar no grupo.');
  return { data: (data as { id: string }).id, error: null };
}

export async function leaveGroup(id: string): Promise<Result<true>> {
  const { error } = await client().rpc('leave_group', { p_group: id });
  if (error) return failure(error, 'Não foi possível sair do grupo.');
  return { data: true, error: null };
}

export async function claimGroupBoss(
  id: string,
  weekStart: LocalDate,
): Promise<Result<{ coins: number }>> {
  const { data, error } = await client().rpc('claim_group_boss', {
    p_group: id,
    p_week_start: weekStart,
  });
  if (error) return failure(error, 'Não foi possível resgatar o prêmio.');
  return {
    data: { coins: Number((data as { coins_awarded: number }).coins_awarded) },
    error: null,
  };
}
