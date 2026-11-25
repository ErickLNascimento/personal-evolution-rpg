import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { radius, spacing } from '@/theme/tokens';
import { useT } from '@/i18n';

/** Cor dos Cristais em todo o app. */
export const CRYSTAL = '#5CE1E6';

/** Saldo de Cristais: ícone + número. */
export function CrystalBadge({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' }) {
  const { t, locale } = useT();
  const small = size === 'sm';
  return (
    <View
      style={[styles.badge, small && styles.badgeSm]}
      accessible
      accessibilityLabel={t('common.crystals', { amount })}
    >
      <Ionicons name="diamond" size={small ? 12 : 15} color={CRYSTAL} />
      <Text style={[styles.amount, small && styles.amountSm]}>{amount.toLocaleString(locale)}</Text>
    </View>
  );
}

/** "+N Cristais" que aparece por 1,8 s quando uma missão rende Cristais. */
export function CrystalToast({ gain }: { gain: { amount: number; key: number } | null }) {
  const { t } = useT();
  // Some sozinho: guarda qual ganho já foi dispensado; um ganho novo (outra `key`) aparece de novo.
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setDismissed(gain.key), 1800);
    return () => clearTimeout(t);
  }, [gain]);
  const shown = gain && gain.key !== dismissed ? gain : null;
  if (!shown) return null;
  return (
    <Animated.View
      key={shown.key}
      entering={FadeInUp.springify().damping(12)}
      exiting={FadeOutUp.duration(250)}
      style={styles.toast}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="diamond" size={16} color={CRYSTAL} />
      <Text style={styles.toastText}>{t('common.plusCrystals', { amount: shown.amount })}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#12303A',
    borderWidth: 1,
    borderColor: '#1F5563',
  },
  badgeSm: { paddingVertical: 2, paddingHorizontal: 6 },
  amount: { fontSize: 15, fontWeight: '800', color: CRYSTAL },
  amountSm: { fontSize: 12 },
  toast: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: '#12303A',
    borderWidth: 1,
    borderColor: CRYSTAL,
  },
  toastText: { fontSize: 15, fontWeight: '800', color: CRYSTAL },
});
