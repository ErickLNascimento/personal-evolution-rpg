import { Ionicons } from '@expo/vector-icons';
import {
  bossText,
  formatSocialCode,
  groupBossState,
  MAX_GROUP_MEMBERS,
  normalizeSocialCode,
  searchQuery,
  socialName,
  validateGroupName,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { BossEmblem } from '@/components/challenges/BossCard';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { FriendRow } from '@/components/social/FriendRow';
import { PillButton } from '@/components/social/PillButton';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  createGroup,
  fetchFriends,
  fetchGroups,
  fetchMySocial,
  joinGroup,
  removeFriend,
  respondFriendRequest,
  searchUsers,
  sendFriendRequest,
  setDiscoverable,
  type FriendsData,
  type GroupInfo,
  type MySocial,
  type Relation,
  type SocialCard,
} from '@/features/social/api';
import type { Result } from '@/features/habits/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { t as tr, useT } from '@/i18n';
import { Chapter, ChapterLabel } from '@/components/profile/Chapter';
import { CampfireHeader } from '@/components/social/CampfireHeader';

const FIRE = '#FB923C';

interface SocialData {
  me: MySocial;
  friends: FriendsData;
  groups: GroupInfo[];
}

type AddMode = 'code' | 'name';

/** Amigos e grupos. Amigos veem só o resumo: herói, nível, streak e missões de hoje. */
export default function SocialScreen() {
  const { t, locale } = useT();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const load = useCallback(async (): Promise<Result<SocialData>> => {
    if (!userId) return { data: null, error: tr('social.signedOut') };
    const [me, friends, groups] = await Promise.all([
      fetchMySocial(userId),
      fetchFriends(),
      fetchGroups(),
    ]);
    if (me.error !== null) return me;
    if (friends.error !== null) return friends;
    if (groups.error !== null) return groups;
    return { data: { me: me.data, friends: friends.data, groups: groups.data }, error: null };
  }, [userId]);
  const screen = useFocusLoad<SocialData>(load, Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run<T>(
    key: string,
    action: () => Promise<Result<T>>,
    ok?: (data: T) => string | null,
  ) {
    setBusy(key);
    setError(null);
    setNotice(null);
    const r = await action();
    setBusy(null);
    if (r.error !== null) {
      setError(r.error);
      return false;
    }
    const message = ok?.(r.data) ?? null;
    if (message) setNotice(message);
    void Haptics.selectionAsync();
    screen.refresh();
    return true;
  }

  if (!screen.data) {
    return (
      <Screen title={t('social.title')}>
        {screen.error ? (
          <>
            <FormMessage text={screen.error} />
            <Button title={t('common.retry')} onPress={screen.refresh} variant="secondary" />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  const { me, friends, groups } = screen.data;
  const code = formatSocialCode(me.friendCode);

  const doneToday = friends.friends.filter(
    (f) => f.todayTotal > 0 && f.todayDone >= f.todayTotal,
  ).length;

  return (
    <Screen title={t('social.title')} onRefresh={screen.refresh} refreshing={screen.refreshing}>
      {notice ? <FormMessage tone="info" text={notice} /> : null}
      <FormMessage text={error} />

      <CampfireHeader friends={friends.friends.length} doneToday={doneToday} bands={groups.length} />

      {friends.incoming.length > 0 && (
        <Chapter
          icon="mail-unread"
          color={colors.xp}
          title={t('campfire.requests', { count: friends.incoming.length })}
          summary={t('campfire.requestsSummary')}
          defaultOpen
        >
          {friends.incoming.map((r) => (
            <FriendRow
              key={r.requestId}
              person={r.user}
              actions={
                <View style={styles.actions}>
                  <PillButton
                    title={t('social.accept')}
                    loading={busy === `accept:${r.requestId}`}
                    onPress={() =>
                      void run(
                        `accept:${r.requestId}`,
                        () => respondFriendRequest(r.requestId, true),
                        () =>
                          t('social.nowFriends', { name: socialName(r.user.displayName, locale) }),
                      )
                    }
                  />
                  <PillButton
                    title={t('social.decline')}
                    tone="secondary"
                    loading={busy === `decline:${r.requestId}`}
                    onPress={() =>
                      void run(`decline:${r.requestId}`, () =>
                        respondFriendRequest(r.requestId, false),
                      )
                    }
                  />
                </View>
              }
            />
          ))}
        </Chapter>
      )}

      <Chapter
        icon="people"
        color={FIRE}
        title={t('campfire.companions')}
        summary={t('campfire.companionsSummary', { count: friends.friends.length })}
        defaultOpen
      >
        {friends.friends.length === 0 ? (
          <Text style={typography.caption}>{t('social.noFriends')}</Text>
        ) : (
          friends.friends.map((f) => (
            <FriendRow
              key={f.userId}
              person={f}
              onPress={() =>
                Alert.alert(
                  socialName(f.displayName, locale),
                  t('social.friendInfo', { level: f.level, streak: f.streak }),
                  [
                    { text: t('social.close'), style: 'cancel' },
                    {
                      text: t('social.unfriend'),
                      style: 'destructive',
                      onPress: () => void run(`remove:${f.userId}`, () => removeFriend(f.userId)),
                    },
                  ],
                )
              }
            />
          ))
        )}
        {friends.outgoing.length > 0 && (
          <>
            <ChapterLabel>{t('social.outgoing')}</ChapterLabel>
            {friends.outgoing.map((r) => (
              <FriendRow
                key={r.requestId}
                person={r.user}
                actions={
                  <PillButton
                    title={t('social.cancel')}
                    tone="secondary"
                    loading={busy === `cancel:${r.user.userId}`}
                    onPress={() =>
                      void run(`cancel:${r.user.userId}`, () => removeFriend(r.user.userId))
                    }
                  />
                }
              />
            ))}
          </>
        )}
      </Chapter>

      <Chapter
        icon="shield-half"
        color={colors.primary}
        title={t('campfire.bandsTitle')}
        summary={
          groups.length === 0
            ? t('social.groupsHint', { max: MAX_GROUP_MEMBERS })
            : t('campfire.bands', { count: groups.length })
        }
        defaultOpen={groups.length > 0}
      >
        {groups.length === 0 && (
          <Text style={typography.caption}>{t('social.groupsHint', { max: MAX_GROUP_MEMBERS })}</Text>
        )}
        {groups.map((g) => (
          <GroupRow key={g.id} group={g} />
        ))}
        <GroupActions
          busy={busy}
          onCreate={(name) =>
            run(
              'create',
              () => createGroup(name),
              () => t('social.groupCreated'),
            )
          }
          onJoin={(c) =>
            run(
              'join',
              () => joinGroup(c),
              () => t('social.groupJoined'),
            )
          }
        />
      </Chapter>

      <Chapter
        icon="person-add"
        color={colors.accent}
        title={t('campfire.invite')}
        summary={t('campfire.inviteSummary', { code })}
      >
        <View style={styles.codeBox}>
          <Text style={typography.label}>{t('social.myCode')}</Text>
          <Text
            style={styles.code}
            selectable
            accessibilityLabel={t('social.myCodeA11y', { code: code.split('').join(' ') })}
          >
            {code}
          </Text>
          <Button
            title={t('social.shareCode')}
            variant="secondary"
            onPress={() =>
              void Share.share({
                message: t('social.shareMessage', { code }),
              })
            }
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={typography.body}>{t('social.discoverable')}</Text>
            <Text style={typography.caption}>{t('social.discoverableHint')}</Text>
          </View>
          <Switch
            value={me.discoverable}
            onValueChange={(on) => void run('discoverable', () => setDiscoverable(userId!, on))}
            accessibilityLabel={t('social.discoverable')}
            trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
          />
        </View>
        <ChapterLabel>{t('social.addFriend')}</ChapterLabel>
        <AddFriend
          busy={busy}
          onSend={(target) =>
            run(
              'add',
              () => sendFriendRequest(target),
              (r) =>
                r.status === 'accepted'
                  ? t('social.nowFriends', { name: socialName(r.user.displayName, locale) })
                  : t('social.requestSent', { name: socialName(r.user.displayName, locale) }),
            )
          }
        />
      </Chapter>
    </Screen>
  );
}

function AddFriend({
  busy,
  onSend,
}: {
  busy: string | null;
  onSend: (target: { code: string } | { userId: string }) => Promise<boolean>;
}) {
  const { t } = useT();
  const [mode, setMode] = useState<AddMode>('code');
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [results, setResults] = useState<{ user: SocialCard; relation: Relation }[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function submit() {
    setFieldError(null);
    if (mode === 'code') {
      const code = normalizeSocialCode(text);
      if (!code) return setFieldError(t('social.badCode'));
      if (await onSend({ code })) setText('');
      return;
    }
    const q = searchQuery(text);
    if (!q) return setFieldError(t('social.shortQuery'));
    setSearching(true);
    const r = await searchUsers(q);
    setSearching(false);
    if (r.error !== null) return setFieldError(r.error);
    setResults(r.data);
  }

  return (
    <View style={styles.add}>
      <Chips
        options={[
          { value: 'code' as const, label: t('social.modeCode') },
          { value: 'name' as const, label: t('social.modeName') },
        ]}
        selected={[mode]}
        onToggle={(m) => {
          setMode(m);
          setResults(null);
          setFieldError(null);
        }}
      />
      <Field
        label={mode === 'code' ? t('social.friendCode') : t('social.name')}
        value={text}
        onChangeText={setText}
        placeholder={mode === 'code' ? t('social.codePlaceholder') : t('social.namePlaceholder')}
        autoCapitalize={mode === 'code' ? 'characters' : 'words'}
        autoCorrect={false}
        maxLength={mode === 'code' ? 8 : 40}
        returnKeyType={mode === 'code' ? 'send' : 'search'}
        onSubmitEditing={() => void submit()}
        error={fieldError}
      />
      <Button
        title={mode === 'code' ? t('social.sendRequest') : t('social.search')}
        onPress={() => void submit()}
        loading={busy === 'add' || searching}
      />
      {results !== null &&
        (results.length === 0 ? (
          <Text style={typography.caption}>{t('social.noResults')}</Text>
        ) : (
          results.map((r) => (
            <FriendRow
              key={r.user.userId}
              person={r.user}
              actions={
                r.relation === 'friend' ? (
                  <Text style={styles.tag}>{t('social.friend')}</Text>
                ) : r.relation === 'pending_out' ? (
                  <Text style={styles.tag}>{t('social.pending')}</Text>
                ) : (
                  <PillButton
                    title={r.relation === 'pending_in' ? t('social.accept') : t('social.add')}
                    onPress={async () => {
                      if (await onSend({ userId: r.user.userId }))
                        setResults((list) =>
                          (list ?? []).map((x) =>
                            x.user.userId === r.user.userId
                              ? {
                                  ...x,
                                  relation: r.relation === 'pending_in' ? 'friend' : 'pending_out',
                                }
                              : x,
                          ),
                        );
                    }}
                  />
                )
              }
            />
          ))
        ))}
    </View>
  );
}

function GroupRow({ group }: { group: GroupInfo }) {
  const { t, locale } = useT();
  const boss = groupBossState(group.weekStart, group.boss.maxHp, group.boss.damage);
  const lastWon =
    group.lastBoss.maxHp > 0 &&
    group.lastBoss.damage >= group.lastBoss.maxHp &&
    !group.lastBoss.claimed;
  const toClaim = (boss.defeated && !group.boss.claimed) || lastWon;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
      accessibilityRole="button"
      accessibilityLabel={t('social.groupA11y', {
        name: group.name,
        count: group.memberCount,
        boss: bossText(boss.boss, locale).name,
        hp: boss.hp,
        max: boss.maxHp,
      })}
      style={({ pressed }) => [styles.group, pressed && styles.pressed]}
    >
      <BossEmblem id={boss.boss.id} size={44} />
      <View style={styles.flex}>
        <Text style={typography.body} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={typography.caption}>
          {t('social.groupPeople', { count: group.memberCount, max: MAX_GROUP_MEMBERS })}
          {boss.maxHp === 0
            ? t('social.noBoss')
            : boss.defeated
              ? t('social.bossDown')
              : t('social.bossHp', { hp: boss.hp })}
        </Text>
        {toClaim && <Text style={styles.claim}>{t('social.toClaim')}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function GroupActions({
  busy,
  onCreate,
  onJoin,
}: {
  busy: string | null;
  onCreate: (name: string) => Promise<boolean>;
  onJoin: (code: string) => Promise<boolean>;
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState<'create' | 'join' | null>(null);
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!open)
    return (
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            title={t('social.createGroup')}
            variant="secondary"
            onPress={() => setOpen('create')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={t('social.joinWithCode')}
            variant="secondary"
            onPress={() => setOpen('join')}
          />
        </View>
      </View>
    );

  async function submit() {
    setFieldError(null);
    if (open === 'create') {
      const { value, error } = validateGroupName(text, locale);
      if (error) return setFieldError(error);
      if (await onCreate(value)) close();
    } else {
      const code = normalizeSocialCode(text);
      if (!code) return setFieldError(t('social.badGroupCode'));
      if (await onJoin(code)) close();
    }
  }

  function close() {
    setOpen(null);
    setText('');
    setFieldError(null);
  }

  return (
    <View style={styles.card}>
      <Field
        label={open === 'create' ? t('social.groupName') : t('social.groupCode')}
        value={text}
        onChangeText={setText}
        placeholder={
          open === 'create' ? t('social.groupNamePlaceholder') : t('social.groupCodePlaceholder')
        }
        autoCapitalize={open === 'create' ? 'sentences' : 'characters'}
        autoCorrect={false}
        maxLength={open === 'create' ? 40 : 8}
        error={fieldError}
      />
      <Button
        title={open === 'create' ? t('social.create') : t('social.join')}
        onPress={() => void submit()}
        loading={busy === 'create' || busy === 'join'}
      />
      <Button title={t('common.cancel')} variant="secondary" onPress={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  add: { gap: spacing.sm },
  code: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.text,
    textAlign: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  actions: { gap: spacing.xs },
  tag: { ...typography.caption, fontWeight: '700' },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  claim: { ...typography.caption, color: colors.xp, fontWeight: '700' },
});
