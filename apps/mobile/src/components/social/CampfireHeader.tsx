import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const FIRE = '#FB923C';

/**
 * Topo da Fogueira: a chama brilha devagar (só a luz muda, nada se move) e o resumo de quem já
 * completou o dia entre os companheiros.
 */
export function CampfireHeader({
  friends,
  doneToday,
  bands,
}: {
  friends: number;
  /** Companheiros com todas as missões de hoje feitas. */
  doneToday: number;
  bands: number;
}) {
  const { t } = useT();
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow]);
  const light = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.4 }));

  const line =
    friends === 0
      ? t('campfire.empty')
      : t(friends === 1 ? 'campfire.doneOne' : 'campfire.doneMany', { done: doneToday, total: friends });

  return (
    <View style={styles.card} accessible accessibilityLabel={`${line} ${t('campfire.bands', { count: bands })}`}>
      <View style={styles.fire}>
        <Animated.View style={[styles.halo, light]} />
        <Ionicons name="bonfire" size={34} color={FIRE} />
      </View>
      <View style={styles.text}>
        <Text style={styles.kicker}>{t('campfire.kicker')}</Text>
        <Text style={typography.body}>{line}</Text>
        <Text style={typography.caption}>{t('campfire.bands', { count: bands })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: `${FIRE}66`,
    backgroundColor: colors.surface,
  },
  fire: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FIRE,
    shadowColor: FIRE,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  text: { flex: 1, gap: 2 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: FIRE },
});
