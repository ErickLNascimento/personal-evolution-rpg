import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

/** Botão compacto para ações dentro de uma linha (aceitar, adicionar, cancelar). */
export function PillButton({
  title,
  onPress,
  tone = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.pill,
        tone === 'primary' ? styles.primary : styles.secondary,
        (pressed || inactive) && styles.dim,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  dim: { opacity: 0.6 },
  text: { fontSize: 14, fontWeight: '700', color: colors.text },
});
