import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_XP_TABLE, DIFFICULTY_LABEL, missionXp, type Mission, type XpTable } from '@per/domain';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

export function MissionCard({
  mission,
  onToggle,
  xpTable = DEFAULT_XP_TABLE,
  busy = false,
  awardedXp,
}: {
  mission: Mission;
  onToggle: () => void;
  xpTable?: XpTable;
  /** Salvando no banco: ignora toques até terminar. */
  busy?: boolean;
  /** XP ganho de fato no registro (se concluída); a dificuldade pode ter mudado depois. */
  awardedXp?: number;
}) {
  const { habit, done } = mission;
  const xp = missionXp({ done, difficulty: habit.difficulty }, awardedXp, xpTable);
  return (
    <Pressable
      onPress={onToggle}
      disabled={busy}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, busy }}
      accessibilityLabel={`${habit.title}, ${xp} XP`}
      accessibilityHint={done ? 'Toque para desfazer' : 'Toque para concluir'}
      style={({ pressed }) => [styles.card, done && styles.cardDone, (pressed || busy) && styles.pressed]}
    >
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={28}
        color={done ? colors.accent : colors.textSecondary}
      />
      <View style={styles.body}>
        <Text style={[typography.body, done && styles.titleDone]}>{habit.title}</Text>
        <Text style={typography.caption}>{DIFFICULTY_LABEL[habit.difficulty]}</Text>
      </View>
      <Text style={styles.xp}>+{xp} XP</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDone: { borderColor: colors.accent },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  xp: { fontWeight: '700', color: colors.xp },
});
