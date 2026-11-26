import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Button } from '@/components/Form';
import { canAskPush, enablePush } from '@/features/push/push';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const FIRE = '#FB923C';
const key = (userId: string) => `push-prompt-dismissed:${userId}`;

/**
 * Tela Hoje: convite para ligar os avisos, só enquanto a permissão ainda não foi decidida e a
 * pessoa não disse "Agora não" (fica guardado neste aparelho).
 */
export function PushPromptCard({ userId }: { userId: string }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (globalThis.localStorage?.getItem(key(userId))) return;
    let alive = true;
    void canAskPush().then((ok) => {
      if (alive) setShow(ok);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!show) return null;

  function dismiss() {
    globalThis.localStorage?.setItem(key(userId), '1');
    setShow(false);
  }

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut} style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="notifications" size={22} color={FIRE} />
        <Text style={[typography.heading, styles.flex]}>{t('push.promptTitle')}</Text>
      </View>
      <Text style={typography.caption}>{t('push.promptText')}</Text>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title={t('push.promptYes')}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await enablePush().catch(() => false);
              setBusy(false);
              dismiss();
            }}
          />
        </View>
        <View style={styles.flex}>
          <Button title={t('push.promptNo')} variant="secondary" onPress={dismiss} />
        </View>
      </View>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
