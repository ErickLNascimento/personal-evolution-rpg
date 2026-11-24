import { Ionicons } from '@expo/vector-icons';
import {
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
import { Placeholder, Screen } from '@/components/Screen';
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

interface SocialData {
  me: MySocial;
  friends: FriendsData;
  groups: GroupInfo[];
}

type AddMode = 'code' | 'name';
const ADD_MODES = [
  { value: 'code' as const, label: 'Código de amigo' },
  { value: 'name' as const, label: 'Buscar por nome' },
];

/** Amigos e grupos. Amigos veem só o resumo: herói, nível, streak e missões de hoje. */
export default function SocialScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const load = useCallback(async (): Promise<Result<SocialData>> => {
    if (!userId) return { data: null, error: 'Você precisa estar conectado.' };
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
      <Screen title="Social">
        {screen.error ? (
          <>
            <FormMessage text={screen.error} />
            <Button title="Tentar de novo" onPress={screen.refresh} variant="secondary" />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </Screen>
    );
  }

  const { me, friends, groups } = screen.data;
  const code = formatSocialCode(me.friendCode);

  return (
    <Screen title="Social" onRefresh={screen.refresh} refreshing={screen.refreshing}>
      {notice ? <FormMessage tone="info" text={notice} /> : null}
      <FormMessage text={error} />

      <View style={styles.card}>
        <Text style={typography.label}>SEU CÓDIGO DE AMIGO</Text>
        <Text
          style={styles.code}
          selectable
          accessibilityLabel={`Seu código: ${code.split('').join(' ')}`}
        >
          {code}
        </Text>
        <Button
          title="Compartilhar código"
          variant="secondary"
          onPress={() =>
            void Share.share({
              message: `Vamos evoluir juntos no Personal Evolution RPG! Meu código de amigo é ${code}.`,
            })
          }
        />
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={typography.body}>Aparecer na busca por nome</Text>
            <Text style={typography.caption}>
              Desligado, só quem tem o seu código consegue adicionar você.
            </Text>
          </View>
          <Switch
            value={me.discoverable}
            onValueChange={(on) => void run('discoverable', () => setDiscoverable(userId!, on))}
            accessibilityLabel="Aparecer na busca por nome"
            trackColor={{ true: colors.primary, false: colors.surfaceRaised }}
          />
        </View>
      </View>

      <AddFriend
        busy={busy}
        onSend={(target) =>
          run(
            'add',
            () => sendFriendRequest(target),
            (r) =>
              r.status === 'accepted'
                ? `Agora você e ${socialName(r.user.displayName)} são amigos!`
                : `Pedido enviado para ${socialName(r.user.displayName)}.`,
          )
        }
      />

      {friends.incoming.length > 0 && (
        <>
          <Text style={typography.label}>PEDIDOS RECEBIDOS</Text>
          {friends.incoming.map((r) => (
            <FriendRow
              key={r.requestId}
              person={r.user}
              actions={
                <View style={styles.actions}>
                  <PillButton
                    title="Aceitar"
                    loading={busy === `accept:${r.requestId}`}
                    onPress={() =>
                      void run(
                        `accept:${r.requestId}`,
                        () => respondFriendRequest(r.requestId, true),
                        () => `Agora você e ${socialName(r.user.displayName)} são amigos!`,
                      )
                    }
                  />
                  <PillButton
                    title="Recusar"
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
        </>
      )}

      <Text style={typography.label}>AMIGOS ({friends.friends.length})</Text>
      {friends.friends.length === 0 ? (
        <Placeholder text="Ainda sem amigos. Compartilhe o seu código ou busque alguém pelo nome. Amigos veem só o seu herói, nível, streak e quantas missões você fez hoje." />
      ) : (
        friends.friends.map((f) => (
          <FriendRow
            key={f.userId}
            person={f}
            onPress={() =>
              Alert.alert(
                socialName(f.displayName),
                `Nível ${f.level} · sequência de ${f.streak} dias`,
                [
                  { text: 'Fechar', style: 'cancel' },
                  {
                    text: 'Desfazer amizade',
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
          <Text style={typography.label}>AGUARDANDO RESPOSTA</Text>
          {friends.outgoing.map((r) => (
            <FriendRow
              key={r.requestId}
              person={r.user}
              actions={
                <PillButton
                  title="Cancelar"
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

      <Text style={typography.label}>GRUPOS</Text>
      <Text style={typography.caption}>
        Até {MAX_GROUP_MEMBERS} pessoas enfrentam juntas o chefe da semana: cada missão de qualquer
        um tira 1 de vida.
      </Text>
      {groups.map((g) => (
        <GroupRow key={g.id} group={g} />
      ))}
      <GroupActions
        busy={busy}
        onCreate={(name) =>
          run(
            'create',
            () => createGroup(name),
            () => 'Grupo criado! Convide a turma com o código.',
          )
        }
        onJoin={(c) =>
          run(
            'join',
            () => joinGroup(c),
            () => 'Você entrou no grupo!',
          )
        }
      />
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
  const [mode, setMode] = useState<AddMode>('code');
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [results, setResults] = useState<{ user: SocialCard; relation: Relation }[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function submit() {
    setFieldError(null);
    if (mode === 'code') {
      const code = normalizeSocialCode(text);
      if (!code) return setFieldError('O código tem 6 letras e números, como K7Q-2PM.');
      if (await onSend({ code })) setText('');
      return;
    }
    const q = searchQuery(text);
    if (!q) return setFieldError('Digite ao menos 2 letras do nome.');
    setSearching(true);
    const r = await searchUsers(q);
    setSearching(false);
    if (r.error !== null) return setFieldError(r.error);
    setResults(r.data);
  }

  return (
    <View style={styles.card}>
      <Text style={typography.label}>ADICIONAR AMIGO</Text>
      <Chips
        options={ADD_MODES}
        selected={[mode]}
        onToggle={(m) => {
          setMode(m);
          setResults(null);
          setFieldError(null);
        }}
      />
      <Field
        label={mode === 'code' ? 'Código do amigo' : 'Nome'}
        value={text}
        onChangeText={setText}
        placeholder={mode === 'code' ? 'Ex.: K7Q-2PM' : 'Ex.: Ana'}
        autoCapitalize={mode === 'code' ? 'characters' : 'words'}
        autoCorrect={false}
        maxLength={mode === 'code' ? 8 : 40}
        returnKeyType={mode === 'code' ? 'send' : 'search'}
        onSubmitEditing={() => void submit()}
        error={fieldError}
      />
      <Button
        title={mode === 'code' ? 'Enviar pedido' : 'Buscar'}
        onPress={() => void submit()}
        loading={busy === 'add' || searching}
      />
      {results !== null &&
        (results.length === 0 ? (
          <Text style={typography.caption}>Ninguém encontrado com esse nome.</Text>
        ) : (
          results.map((r) => (
            <FriendRow
              key={r.user.userId}
              person={r.user}
              actions={
                r.relation === 'friend' ? (
                  <Text style={styles.tag}>Amigo</Text>
                ) : r.relation === 'pending_out' ? (
                  <Text style={styles.tag}>Pedido enviado</Text>
                ) : (
                  <PillButton
                    title={r.relation === 'pending_in' ? 'Aceitar' : 'Adicionar'}
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
      accessibilityLabel={`Grupo ${group.name}, ${group.memberCount} membros, chefe ${boss.boss.name} com vida ${boss.hp} de ${boss.maxHp}`}
      style={({ pressed }) => [styles.group, pressed && styles.pressed]}
    >
      <BossEmblem id={boss.boss.id} size={44} />
      <View style={styles.flex}>
        <Text style={typography.body} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={typography.caption}>
          {group.memberCount}/{MAX_GROUP_MEMBERS} pessoas ·{' '}
          {boss.maxHp === 0
            ? 'sem chefe esta semana'
            : boss.defeated
              ? 'chefe derrotado!'
              : `chefe com ${boss.hp} de vida`}
        </Text>
        {toClaim && <Text style={styles.claim}>Prêmio para resgatar</Text>}
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
  const [open, setOpen] = useState<'create' | 'join' | null>(null);
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!open)
    return (
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title="Criar grupo" variant="secondary" onPress={() => setOpen('create')} />
        </View>
        <View style={styles.flex}>
          <Button title="Entrar com código" variant="secondary" onPress={() => setOpen('join')} />
        </View>
      </View>
    );

  async function submit() {
    setFieldError(null);
    if (open === 'create') {
      const { value, error } = validateGroupName(text);
      if (error) return setFieldError(error);
      if (await onCreate(value)) close();
    } else {
      const code = normalizeSocialCode(text);
      if (!code) return setFieldError('O código do grupo tem 6 letras e números.');
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
        label={open === 'create' ? 'Nome do grupo' : 'Código do grupo'}
        value={text}
        onChangeText={setText}
        placeholder={open === 'create' ? 'Ex.: Time da manhã' : 'Ex.: H4K-9TZ'}
        autoCapitalize={open === 'create' ? 'sentences' : 'characters'}
        autoCorrect={false}
        maxLength={open === 'create' ? 40 : 8}
        error={fieldError}
      />
      <Button
        title={open === 'create' ? 'Criar' : 'Entrar'}
        onPress={() => void submit()}
        loading={busy === 'create' || busy === 'join'}
      />
      <Button title="Cancelar" variant="secondary" onPress={close} />
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
