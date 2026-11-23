import { StyleSheet, Text, View } from 'react-native';
import type { LevelProgress } from '@per/domain';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function XpBar({ progress }: { progress: LevelProgress }) {
  const pct = Math.round(progress.progress * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Nível ${progress.level}`}
      accessibilityValue={{ min: 0, max: 100, now: pct, text: `${progress.xpToNextLevel} XP para o próximo nível` }}
    >
      <View style={styles.row}>
        <Text style={styles.level}>Nível {progress.level}</Text>
        <Text style={styles.xp}>{progress.totalXp} XP</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={typography.caption}>{progress.xpToNextLevel} XP para o nível {progress.level + 1}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { ...typography.heading },
  xp: { fontSize: 16, fontWeight: '700', color: colors.xp },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  fill: { height: '100%', backgroundColor: colors.xp, borderRadius: radius.pill },
});
