import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useT } from '@/i18n';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const LAYOUT = LinearTransition.duration(220);

/**
 * Capítulo do Perfil (estilo grimório de RPG): cabeçalho com gema, título e resumo; toque abre e
 * fecha o conteúdo. Vários podem ficar abertos ao mesmo tempo.
 */
export function Chapter({
  icon,
  color,
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  icon: IconName;
  /** Cor da gema e do contorno quando aberto. */
  color: string;
  title: string;
  /** Uma linha mostrada com o capítulo fechado (ex.: o fuso escolhido). */
  summary?: string | null;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);
  const turn = useSharedValue(defaultOpen ? 1 : 0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 200 });
  }, [open, turn]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <Animated.View
      layout={LAYOUT}
      style={[styles.card, open && { borderColor: `${color}88`, shadowColor: color }]}
    >
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary ? `${title}. ${summary}` : title}
        accessibilityHint={open ? t('profileMenu.collapse') : t('profileMenu.expand')}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={[styles.gem, { borderColor: color, backgroundColor: `${color}1F` }]}>
          <View style={styles.gemIcon}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
        </View>
        <View style={styles.titles}>
          <Text style={[styles.title, open && { color }]} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
          {!open && summary ? (
            <Text style={typography.caption} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={styles.body}>
          <Ornament color={color} />
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** Divisor "──◆──" na cor do capítulo. */
function Ornament({ color }: { color: string }) {
  return (
    <View style={styles.ornament} importantForAccessibility="no-hide-descendants">
      <View style={[styles.line, { backgroundColor: `${color}55` }]} />
      <View style={[styles.diamond, { backgroundColor: color }]} />
      <View style={[styles.line, { backgroundColor: `${color}55` }]} />
    </View>
  );
}

/** Subtítulo dentro de um capítulo (ex.: "Fuso horário" em Ajustes do reino). */
export function ChapterLabel({ children }: { children: string }) {
  return (
    <Text style={[typography.label, styles.label]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowColor: 'transparent',
    overflow: 'hidden',
  },
  header: {
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.8 },
  // Gema: quadrado girado 45°, com o ícone desgirado por dentro.
  gem: {
    width: 30,
    height: 30,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  gemIcon: { transform: [{ rotate: '-45deg' }] },
  titles: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: 1.4, color: colors.text },
  body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  line: { flex: 1, height: 1 },
  diamond: { width: 7, height: 7, transform: [{ rotate: '45deg' }] },
  label: { marginTop: spacing.sm },
});
