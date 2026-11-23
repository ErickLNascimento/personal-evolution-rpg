import type { DailyXp } from '@per/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

const CHART_HEIGHT = 120;

function shortDate(date: string) {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long' });
}

/**
 * XP por dia: uma série, barras finas ancoradas na base.
 * Toque numa barra para ver o valor; o último dia começa selecionado.
 */
export function XpChart({ days }: { days: DailyXp[] }) {
  const [selected, setSelected] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.xp));
  const current = days[selected] ?? days[days.length - 1];
  const total = days.reduce((sum, d) => sum + Math.max(0, d.xp), 0);

  if (!current) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={styles.value}>{Math.max(0, current.xp)} XP</Text>
        <Text style={typography.caption}>{longDate(current.date)}</Text>
      </View>

      <View style={styles.plot}>
        {days.map((d, i) => {
          const h = d.xp > 0 ? Math.max(4, (d.xp / max) * CHART_HEIGHT) : 0;
          const active = i === selected;
          return (
            <Pressable
              key={d.date}
              onPress={() => setSelected(i)}
              accessibilityRole="button"
              accessibilityLabel={`${longDate(d.date)}: ${Math.max(0, d.xp)} XP`}
              accessibilityState={{ selected: active }}
              style={styles.slot}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <View style={[styles.bar, { height: h }, !active && styles.barIdle]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.baseline} />

      <View style={styles.axis}>
        <Text style={typography.caption}>{shortDate(days[0]!.date)}</Text>
        <Text style={typography.caption}>{shortDate(days[days.length - 1]!.date)}</Text>
      </View>
      <Text style={typography.caption}>
        Total no período: {total} XP. Toque numa barra para ver o dia.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  value: { fontSize: 20, fontWeight: '700', color: colors.text },
  plot: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.xp, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barIdle: { opacity: 0.55 },
  baseline: { height: 1, backgroundColor: colors.border },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
