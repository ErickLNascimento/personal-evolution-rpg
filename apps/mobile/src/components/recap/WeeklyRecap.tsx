import { Ionicons } from '@expo/vector-icons';
import type { RecapTier, WeeklyRecap } from '@per/domain';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatShortDate } from '@/components/vacation/formatDate';
import { useT, type TKey } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const RECAP_TIER: Record<RecapTier, { icon: IconName; color: string; title: TKey; text: TKey }> = {
  legendary: { icon: 'trophy', color: colors.xp, title: 'recap.legendary', text: 'recap.legendaryText' },
  great: { icon: 'flame', color: '#FB923C', title: 'recap.great', text: 'recap.greatText' },
  good: { icon: 'trending-up', color: colors.accent, title: 'recap.good', text: 'recap.goodText' },
  restart: { icon: 'refresh', color: colors.primary, title: 'recap.restart', text: 'recap.restartText' },
};

/**
 * Crônica da semana (conteúdo do capítulo no Progresso): manchete, missões, dias perfeitos e XP
 * comparados com a semana de antes, o hábito mais constante e se o chefe caiu.
 */
export function WeeklyRecapBody({ recap: r }: { recap: WeeklyRecap }) {
  const { t, locale } = useT();
  const tier = RECAP_TIER[r.tier];
  const pct = Math.round(r.week.rate * 100);
  return (
    <View style={styles.body}>
      <Text style={typography.caption}>
        {t('recap.range', {
          start: formatShortDate(r.week.weekStart, locale),
          end: formatShortDate(r.week.weekEnd, locale),
        })}
      </Text>
      <Text style={typography.heading} accessibilityRole="header">
        {t(tier.title)}
      </Text>
      <Text style={typography.caption}>{t(tier.text)}</Text>

      <View style={styles.stats}>
        <Stat
          value={`${r.week.completed}/${r.week.scheduled}`}
          label={t('recap.missions', { pct })}
          delta={r.completedDelta}
        />
        <Stat value={String(r.week.perfectDays)} label={t('recap.perfectDays')} />
        <Stat value={String(r.week.xp)} label="XP" delta={r.xpDelta} />
      </View>

      {r.bestHabit && (
        <Text style={typography.body}>
          ⭐ {t('recap.bestHabit', { title: r.bestHabit.title, done: r.bestHabit.done, total: r.bestHabit.scheduled })}
        </Text>
      )}
      <Text style={typography.body}>
        {r.bossDefeated ? `⚔️ ${t('recap.bossDefeated')}` : `🛡 ${t('recap.bossSurvived')}`}
      </Text>
    </View>
  );
}

function Stat({ value, label, delta }: { value: string; label: string; delta?: number }) {
  const { t } = useT();
  const up = (delta ?? 0) > 0;
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={
        !delta
          ? `${label}: ${value}`
          : `${label}: ${value}, ${t(up ? 'recap.moreThan' : 'recap.lessThan', { n: Math.abs(delta) })}`
      }
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {!!delta && (
        <Text style={[styles.delta, { color: up ? colors.accent : colors.danger }]}>
          {up ? '▲' : '▼'} {Math.abs(delta)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  delta: { fontSize: 11, fontWeight: '800' },
});
