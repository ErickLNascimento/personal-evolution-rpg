import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme/tokens';

/** Selo dourado de dia perfeito: entra com salto, brilha e vibra. */
export function PerfectDayBanner({ text }: { text: string }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), 6, true);
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.3 + glow.value * 0.6, borderColor: glow.value > 0.5 ? '#FFE08A' : colors.xp }));

  return (
    <Animated.View entering={ZoomIn.springify().damping(9)} style={[styles.banner, glowStyle]} accessibilityLiveRegion="polite">
      <Ionicons name="star" size={26} color={colors.xp} />
      <View style={styles.body}>
        <Text style={styles.title}>DIA PERFEITO!</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <Ionicons name="star" size={26} color={colors.xp} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: '#2A2210',
    shadowColor: colors.xp,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  body: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 2, color: colors.xp },
  text: { fontSize: 14, color: colors.text },
});
