import { socialName, todayInvite } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { PillButton } from '@/components/social/PillButton';
import { respondFriendRequest } from '@/features/social/api';
import {
  dropInvite,
  postponeInvite,
  refreshInvites,
  useInvitesState,
} from '@/features/social/invites';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const FIRE = '#FB923C';

/**
 * Tela Hoje: o convite de amizade mais novo, com Aceitar, Recusar e Depois. Os outros convites
 * ficam na Fogueira (link no rodapé). Some quando não há convite para mostrar.
 */
export function FriendInviteCard() {
  const { t, locale } = useT();
  const { requests, postponed } = useInvitesState();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shown = todayInvite(requests, postponed);
  // A mensagem de "agora são amigos" some sozinha.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  if (!shown) {
    return notice ? (
      <Animated.View entering={FadeIn} exiting={FadeOut}>
        <FormMessage tone="info" text={notice} />
      </Animated.View>
    ) : null;
  }
  const { request, others } = shown;
  const name = socialName(request.user.displayName, locale);

  async function respond(accept: boolean) {
    setBusy(accept ? 'accept' : 'decline');
    setError(null);
    const r = await respondFriendRequest(request.requestId, accept);
    setBusy(null);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotice(accept ? t('social.nowFriends', { name }) : t('invites.declined'));
    dropInvite(request.requestId);
    void refreshInvites();
  }

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition}
      style={styles.card}
    >
      <Text style={styles.kicker}>{t('invites.kicker')}</Text>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <HeroAvatar hero={request.user.hero} size={44} />
        </View>
        <View style={styles.body}>
          <Text style={typography.body} numberOfLines={2}>
            {t('invites.wants', { name })}
          </Text>
          <Text style={typography.caption}>
            {t('invites.level', { level: request.user.level })}
          </Text>
        </View>
      </View>
      <FormMessage text={error} />
      <View style={styles.actions}>
        <PillButton
          title={t('social.accept')}
          loading={busy === 'accept'}
          disabled={busy !== null}
          onPress={() => void respond(true)}
        />
        <PillButton
          title={t('social.decline')}
          tone="secondary"
          loading={busy === 'decline'}
          disabled={busy !== null}
          onPress={() => void respond(false)}
        />
        <View style={styles.flex} />
        <Pressable
          onPress={() => postponeInvite(request.requestId)}
          disabled={busy !== null}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.later}>{t('invites.later')}</Text>
        </Pressable>
      </View>
      {others > 0 && (
        <Pressable onPress={() => router.push('/social')} accessibilityRole="link" hitSlop={6}>
          <Text style={styles.more}>
            {others === 1 ? t('invites.moreOne') : t('invites.more', { count: others })}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: `${FIRE}88`,
    backgroundColor: colors.surface,
  },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: FIRE },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  later: { ...typography.caption, fontWeight: '700' },
  more: { ...typography.caption, color: FIRE, fontWeight: '700' },
});
