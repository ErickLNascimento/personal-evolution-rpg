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
import { t, type TKey } from '@/i18n';

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

const MESSAGES: Record<string, TKey> = {
  P0002: 'social.errorNotFound',
  PR040: 'social.errorOwnCode',
  PR041: 'social.errorAlreadyFriends',
  PR042: 'social.errorLimit',
  PR043: 'social.errorGroups',
  PR044: 'social.errorFull',
  PR032: 'challenges.errorNotDefeated',
};

function failure(error: PostgrestError, fallback: string): { data: null; error: string } {
  const known = error.code ? MESSAGES[error.code] : undefined;
  if (known) return { data: null, error: t(known) };
  // Banco ainda sem a migration do social.
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42703')
    return { data: null, error: t('social.errorUnavailable') };
  if (/network|fetch/i.test(error.message)) return { data: null, error: t('common.noConnection') };
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
  if (error) return failure(error, t('social.errorLoadCode'));
  return { data: { friendCode: data.friend_code, discoverable: data.discoverable }, error: null };
}

export async function setDiscoverable(userId: string, on: boolean): Promise<Result<true>> {
  const { error } = await client().from('profiles').update({ discoverable: on }).eq('id', userId);
  if (error) return failure(error, t('social.errorSave'));
  return { data: true, error: null };
}

export async function fetchFriends(): Promise<Result<FriendsData>> {
  const { data, error } = await client().rpc('my_friends');
  if (error) return failure(error, t('social.errorLoadFriends'));
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

/** Pedidos recebidos e pendentes, do mais novo ao mais antigo (aviso de convite). */
export async function fetchIncomingRequests(): Promise<Result<FriendRequest[]>> {
  const { data, error } = await client().rpc('incoming_friend_requests');
  if (error) return failure(error, t('social.errorLoadFriends'));
  const rows = (data ?? []) as { request_id: string; user: CardRow }[];
  return {
    data: rows.map((r) => ({ requestId: r.request_id, user: toCard(r.user) })),
    error: null,
  };
}

export async function sendFriendRequest(
  target: { code: string } | { userId: string },
): Promise<Result<{ status: 'pending' | 'accepted'; user: SocialCard }>> {
  const args = 'code' in target ? { p_code: target.code } : { p_user: target.userId };
  const { data, error } = await client().rpc('send_friend_request', args);
  if (error) return failure(error, t('social.errorSend'));
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
  if (error) return failure(error, t('social.errorRespond'));
  return { data: true, error: null };
}

/** Desfaz a amizade ou cancela um pedido. */
export async function removeFriend(userId: string): Promise<Result<true>> {
  const { error } = await client().rpc('remove_friend', { p_user: userId });
  if (error) return failure(error, t('social.errorRemove'));
  return { data: true, error: null };
}

export async function searchUsers(
  query: string,
): Promise<Result<{ user: SocialCard; relation: Relation }[]>> {
  const { data, error } = await client().rpc('search_users', { p_query: query });
  if (error) return failure(error, t('social.errorSearch'));
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
  if (error) return failure(error, t('social.errorLoadGroups'));
  return { data: (data as GroupRow[]).map(toGroup), error: null };
}

export async function fetchGroup(id: string): Promise<Result<GroupInfo>> {
  const { data, error } = await client().rpc('group_detail', { p_group: id });
  if (error) return failure(error, t('social.errorLoadGroup'));
  return { data: toGroup(data as GroupRow), error: null };
}

export async function createGroup(name: string): Promise<Result<string>> {
  const { data, error } = await client().rpc('create_group', { p_name: name });
  if (error) return failure(error, t('social.errorCreateGroup'));
  return { data: (data as { id: string }).id, error: null };
}

export async function joinGroup(code: string): Promise<Result<string>> {
  const { data, error } = await client().rpc('join_group', { p_code: code });
  if (error) return failure(error, t('social.errorJoinGroup'));
  return { data: (data as { id: string }).id, error: null };
}

export async function leaveGroup(id: string): Promise<Result<true>> {
  const { error } = await client().rpc('leave_group', { p_group: id });
  if (error) return failure(error, t('social.errorLeaveGroup'));
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
  if (error) return failure(error, t('challenges.errorClaim'));
  return {
    data: { coins: Number((data as { coins_awarded: number }).coins_awarded) },
    error: null,
  };
}
