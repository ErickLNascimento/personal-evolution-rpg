import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={typography.label}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        {...input}
        style={[styles.input, error ? styles.inputError : null, input.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryText]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function FormMessage({ text, tone = 'error' }: { text: string | null; tone?: 'error' | 'info' }) {
  if (!text) return null;
  return (
    <View style={[styles.message, tone === 'info' ? styles.messageInfo : styles.messageError]} accessibilityLiveRegion="polite">
      <Text style={typography.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger },
  button: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.text },
  secondaryText: { color: colors.text },
  message: { padding: spacing.md, borderRadius: radius.md, borderLeftWidth: 3, backgroundColor: colors.surfaceRaised },
  messageError: { borderLeftColor: colors.danger },
  messageInfo: { borderLeftColor: colors.accent },
});
