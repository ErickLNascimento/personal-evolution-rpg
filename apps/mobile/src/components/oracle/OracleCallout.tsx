import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';
import { Oracle } from './Oracle';
import { useT } from '@/i18n';

const CYAN = '#5CF2E0';

/** Convite do Oráculo: personagem + fala, tocável (leva à tela do Oráculo, por exemplo). */
export function OracleCallout({
  says,
  action,
  onPress,
}: {
  says: string;
  /** Texto curto da ação, mostrado em destaque embaixo da fala. */
  action: string;
  onPress: () => void;
}) {
  const { t } = useT();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t('oracle.name')}: ${says} ${action}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Oracle size={84} />
      <View style={styles.body}>
        <Text style={styles.name}>{t('oracle.name').toUpperCase()}</Text>
        <Text style={styles.says}>{says}</Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Ionicons name="chevron-forward" size={16} color={CYAN} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH + spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    paddingLeft: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: CYAN,
    backgroundColor: '#14202A',
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: CYAN },
  says: { fontSize: 14, lineHeight: 20, color: colors.text },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  actionText: { fontSize: 14, fontWeight: '800', color: CYAN },
});
