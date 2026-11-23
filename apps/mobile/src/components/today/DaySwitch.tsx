import { Ionicons } from '@expo/vector-icons';
import type { LocalDate, WeekDay } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme/tokens';

const DOT = 26;
const STROKE = 3;

/**
 * Seletor "Ontem | Hoje": os dois dias que ainda aceitam registro, cada um com o anel
 * e a contagem de missões. (O histórico da semana fica na aba Progresso.)
 */
export function DaySwitch({
  days,
  selected,
  onSelect,
}: {
  /** Ontem e hoje, nessa ordem. */
  days: readonly WeekDay[];
  selected: LocalDate;
  onSelect: (date: LocalDate) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Dia das missões">
      {days.map((d) => {
        const active = d.date === selected;
        const { done, total, perfect, ratio } = d.progress;
        const name = d.isToday ? 'Hoje' : 'Ontem';
        const status =
          total === 0 ? 'sem missões' : perfect ? 'dia perfeito' : `${done} de ${total}`;
        return (
          <Pressable
            key={d.date}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onSelect(d.date);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${name}, ${status}`}
            style={({ pressed }) => [
              styles.option,
              active && styles.active,
              pressed && styles.pressed,
            ]}
          >
            <Ring ratio={ratio} perfect={perfect} />
            <Text style={[styles.name, active && styles.nameActive]}>{name}</Text>
            <Text style={[styles.count, perfect && { color: colors.xp }]}>
              {total === 0 ? '—' : `${done}/${total}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Ring({ ratio, perfect }: { ratio: number; perfect: boolean }) {
  const r = (DOT - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const color = perfect ? colors.xp : colors.accent;
  return (
    <View style={styles.ring}>
      <Svg width={DOT} height={DOT}>
        <Circle
          cx={DOT / 2}
          cy={DOT / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        {ratio > 0 && (
          <Circle
            cx={DOT / 2}
            cy={DOT / 2}
            r={r}
            stroke={color}
            strokeWidth={STROKE}
            fill={perfect ? color : 'none'}
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - ratio)}
            transform={`rotate(-90 ${DOT / 2} ${DOT / 2})`}
          />
        )}
      </Svg>
      {perfect && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Ionicons name="checkmark" size={15} color={colors.background} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  active: { backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  nameActive: { color: colors.text },
  count: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  ring: { width: DOT, height: DOT },
  center: { alignItems: 'center', justifyContent: 'center' },
});
