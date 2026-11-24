import {
  addDays,
  formatSocialCode,
  GROUP_BOSS_REWARD,
  groupBossState,
  MAX_GROUP_MEMBERS,
  FEATURES,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, View } from 'react-native';
import { BossCard } from '@/components/challenges/BossCard';
import { Button, FormMessage } from '@/components/Form';
import { FeatureGate } from '@/components/FeatureGate';
import { StackScreen } from '@/components/Screen';
import { FriendRow } from '@/components/social/FriendRow';
import { claimGroupBoss, fetchGroup, leaveGroup, type GroupInfo } from '@/features/social/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Grupo: chefe da semana em conjunto, membros com o resumo de cada um e o convite. */
function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => fetchGroup(id), [id]);
  const screen = useFocusLoad<GroupInfo>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!screen.data) {
    return (
      <StackScreen>
        {screen.error ? (
          <FormMessage text={screen.error} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }
  const group = screen.data;
  const code = formatSocialCode(group.inviteCode);
  const lastWeek = addDays(group.weekStart, -7);
  const boss = groupBossState(group.weekStart, group.boss.maxHp, group.boss.damage);
  const previous = groupBossState(lastWeek, group.lastBoss.maxHp, group.lastBoss.damage);

  async function claim(week: string) {
    setBusy(week);
    setError(null);
    const r = await claimGroupBoss(group.id, week);
    setBusy(null);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotice(`Vitória do grupo: +${r.data.coins} Cristais!`);
    screen.refresh();
  }

  return (
    <StackScreen>
      <Text style={typography.title}>{group.name}</Text>
      {notice ? <FormMessage tone="info" text={notice} /> : null}
      <FormMessage text={error} />

      {previous.defeated && !group.lastBoss.claimed && (
        <BossCard
          label="CHEFE DO GRUPO · SEMANA PASSADA"
          state={previous}
          claimed={false}
          reward={GROUP_BOSS_REWARD}
          busy={busy === lastWeek}
          onClaim={() => claim(lastWeek)}
        />
      )}
      <BossCard
        label="CHEFE DO GRUPO"
        state={boss}
        claimed={group.boss.claimed}
        reward={GROUP_BOSS_REWARD}
        busy={busy === group.weekStart}
        onClaim={() => claim(group.weekStart)}
      />

      <Text style={typography.label}>
        MEMBROS ({group.memberCount}/{MAX_GROUP_MEMBERS})
      </Text>
      {(group.members ?? []).map((m) => (
        <FriendRow key={m.userId} person={m} />
      ))}

      <View style={styles.card}>
        <Text style={typography.label}>CONVITE</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        <Text style={typography.caption}>
          Quem tiver este código entra pela aba Social → Entrar com código.
        </Text>
        <Button
          title="Compartilhar convite"
          variant="secondary"
          disabled={group.memberCount >= MAX_GROUP_MEMBERS}
          onPress={() =>
            void Share.share({
              message: `Entre no meu grupo "${group.name}" no Personal Evolution RPG e vamos derrotar o chefe da semana juntos! Código do grupo: ${code}.`,
            })
          }
        />
      </View>

      <Button
        title="Sair do grupo"
        variant="danger"
        loading={busy === 'leave'}
        onPress={() =>
          Alert.alert(
            'Sair do grupo?',
            group.memberCount === 1
              ? 'Você é a última pessoa: o grupo será apagado.'
              : 'Você pode voltar depois com o código de convite.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Sair',
                style: 'destructive',
                onPress: async () => {
                  setBusy('leave');
                  const r = await leaveGroup(group.id);
                  setBusy(null);
                  if (r.error !== null) setError(r.error);
                  else router.back();
                },
              },
            ],
          )
        }
      />
    </StackScreen>
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.text,
    textAlign: 'center',
  },
});

export default function GroupScreenRoute() {
  return (
    <FeatureGate feature={FEATURES.social}>
      <GroupScreen />
    </FeatureGate>
  );
}
