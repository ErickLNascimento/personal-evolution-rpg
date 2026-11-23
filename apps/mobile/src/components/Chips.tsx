import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  /** Nome lido pelo leitor de tela, quando o rótulo é abreviado. */
  accessibilityLabel?: string;
}

/** Grupo de chips. `multiple` = seleção múltipla (checkbox); senão, escolha única (radio). */
export function Chips<T extends string | number>({
  options,
  selected,
  onToggle,
  multiple = false,
}: {
  options: readonly ChipOption<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  multiple?: boolean;
}) {
  return (
    <View style={styles.row} accessibilityRole={multiple ? undefined : 'radiogroup'}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onToggle(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: active } : { selected: active }}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            style={({ pressed }) => [styles.chip, active && styles.active, pressed && styles.pressed]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  activeLabel: { color: colors.text },
});
