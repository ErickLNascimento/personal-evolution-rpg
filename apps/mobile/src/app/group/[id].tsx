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
import { useT } from '@/i18n';
import { useCelebration } from '@/features/celebration/CelebrationProvider';

/** Grupo: chefe da semana em conjunto, membros com o resumo de cada um e o convite. */
function GroupScreen() {
  const { askFeedback } = useCelebration();
  const { t } = useT();
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
    setNotice(t('social.groupWin', { coins: r.data.coins }));
    screen.refresh();
    askFeedback('boss_defeated');
  }

  return (
    <StackScreen>
      <Text style={typography.title}>{group.name}</Text>
      {notice ? <FormMessage tone="info" text={notice} /> : null}
      <FormMessage text={error} />

      {previous.defeated && !group.lastBoss.claimed && (
        <BossCard
          label={t('social.groupBossLast')}
          state={previous}
          claimed={false}
          reward={GROUP_BOSS_REWARD}
          busy={busy === lastWeek}
          onClaim={() => claim(lastWeek)}
        />
      )}
      <BossCard
        label={t('social.groupBoss')}
        state={boss}
        claimed={group.boss.claimed}
        reward={GROUP_BOSS_REWARD}
        busy={busy === group.weekStart}
        onClaim={() => claim(group.weekStart)}
      />

      <Text style={typography.label}>
        {t('social.members', { count: group.memberCount, max: MAX_GROUP_MEMBERS })}
      </Text>
      {(group.members ?? []).map((m) => (
        <FriendRow key={m.userId} person={m} />
      ))}

      <View style={styles.card}>
        <Text style={typography.label}>{t('social.invite')}</Text>
        <Text style={styles.code} selectable>
          {code}
        </Text>
        <Text style={typography.caption}>{t('social.inviteHint')}</Text>
        <Button
          title={t('social.shareInvite')}
          variant="secondary"
          disabled={group.memberCount >= MAX_GROUP_MEMBERS}
          onPress={() =>
            void Share.share({
              message: t('social.inviteMessage', { name: group.name, code }),
            })
          }
        />
      </View>

      <Button
        title={t('social.leave')}
        variant="danger"
        loading={busy === 'leave'}
        onPress={() =>
          Alert.alert(
            t('social.leaveTitle'),
            group.memberCount === 1 ? t('social.leaveLast') : t('social.leaveBack'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('social.leaveConfirm'),
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
