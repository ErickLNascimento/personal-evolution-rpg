import { Ionicons } from '@expo/vector-icons';
import {
  OBJECTIVE_CATEGORY_LABEL,
  PATHS,
  PATH_INFO,
  stageName,
  lookAtStage,
  type HeroLook,
  type PathId,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { HeroAvatar } from './HeroAvatar';

/** Lista dos 7 caminhos: área de vida, lema e como o herói começa e se divide. */
export function PathPicker({
  look,
  value,
  onChoose,
  suggested,
}: {
  /** Aparência atual, para mostrar o herói em cada caminho. */
  look: HeroLook;
  value: PathId | null;
  onChoose: (path: PathId) => void;
  /** Caminho sugerido pelas áreas escolhidas. */
  suggested?: PathId;
}) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {PATHS.map((p) => {
        const info = PATH_INFO[p];
        const active = value === p;
        const areas = info.areas.map((a) => OBJECTIVE_CATEGORY_LABEL[a]).join(' e ');
        const line = `${stageName(p, null, 0, look.form)} → ${stageName(p, null, 2, look.form)} → ${stageName(p, 'A', 3, look.form)} ou ${stageName(p, 'B', 3, look.form)}`;
        return (
          <Pressable
            key={p}
            onPress={() => {
              void Haptics.selectionAsync();
              onChoose(p);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${info.label}, ${areas}. ${info.motto} ${line}`}
            style={({ pressed }) => [
              styles.card,
              active && styles.active,
              pressed && styles.pressed,
            ]}
          >
            <HeroAvatar hero={{ ...lookAtStage(look, p, null, 0), aura: 'nenhuma' }} size={52} />
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={typography.heading}>{info.label}</Text>
                {suggested === p && <Text style={styles.badge}>SUGERIDO</Text>}
              </View>
              <Text style={styles.areas}>{areas}</Text>
              <Text style={typography.caption}>{info.motto}</Text>
              <Text style={styles.line}>{line}</Text>
            </View>
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={active ? colors.primary : colors.textSecondary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  active: { borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.accent,
  },
  areas: { fontSize: 13, fontWeight: '600', color: colors.xp },
  line: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
