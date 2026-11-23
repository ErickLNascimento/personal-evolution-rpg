import { Ionicons } from '@expo/vector-icons';
import type { AttributeProgress, ObjectiveCategory } from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const ICON: Record<ObjectiveCategory, keyof typeof Ionicons.glyphMap> = {
  health: 'fitness',
  wellbeing: 'leaf',
  knowledge: 'book',
  career: 'briefcase',
  productivity: 'flash',
  finance: 'diamond',
  relationships: 'people',
  personal_growth: 'trending-up',
};

const COLOR: Record<ObjectiveCategory, string> = {
  health: '#F2617A',
  wellbeing: '#16C79A',
  knowledge: '#3D7BFF',
  career: '#C98E66',
  productivity: '#F5B942',
  finance: '#2EC4B6',
  relationships: '#FF8A3D',
  personal_growth: '#8B5CF6',
};

/** Ficha de RPG: cada área dos hábitos vira um atributo com nível próprio. */
export function AttributeSheet({ attributes }: { attributes: AttributeProgress[] }) {
  const trained = attributes.some((a) => a.xp > 0);
  return (
    <View style={styles.grid}>
      {!trained && (
        <Text style={typography.caption}>
          Conclua missões ligadas a objetivos para treinar os atributos. Cada área tem o seu.
        </Text>
      )}
      {attributes.map((a) => {
        const pct = Math.round(a.progress * 100);
        const color = COLOR[a.category];
        return (
          <View
            key={a.category}
            style={styles.item}
            accessible
            accessibilityLabel={`${a.label}, nível ${a.level}, ${a.xp} XP`}
          >
            <View style={[styles.icon, { backgroundColor: `${color}22` }]}>
              <Ionicons name={ICON[a.category]} size={18} color={color} />
            </View>
            <View style={styles.body}>
              <View style={styles.row}>
                <Text style={typography.body}>{a.label}</Text>
                <Text style={[styles.level, { color: a.xp > 0 ? color : colors.textSecondary }]}>Nv {a.level}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { fontWeight: '800' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
