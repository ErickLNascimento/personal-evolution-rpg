import { bossTitle, rankLabel, type BestiaryEntry } from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import { BOSS_COLOR, RankGems } from '@/components/challenges/BossCard';
import { BossSprite, RANK_TINT } from '@/components/challenges/BossSprite';
import { formatShortDate } from '@/components/vacation/formatDate';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/**
 * Bestiário: os chefes do Ato I em cartões. Vencido = caído na pose de derrota, na cor da maior
 * patente vencida, com vitórias e a primeira data; nunca vencido = silhueta e "???".
 */
export function Bestiary({ entries }: { entries: readonly BestiaryEntry[] }) {
  return (
    <View style={styles.grid}>
      {entries.map((e) => (
        <BestiaryCard key={e.boss.id} entry={e} />
      ))}
    </View>
  );
}

function BestiaryCard({ entry }: { entry: BestiaryEntry }) {
  const { t, locale } = useT();
  const known = entry.bestRank !== null;
  const name = known ? bossTitle(entry.boss, 0, locale) : '???';
  const a11y = known
    ? t('bestiary.cardA11y', {
        name,
        wins: entry.wins,
        rank: rankLabel(entry.bestRank!, locale),
      })
    : t('bestiary.unknownA11y');
  return (
    <View style={styles.card} accessible accessibilityLabel={a11y}>
      <View style={[styles.stage, { borderColor: known ? (BOSS_COLOR[entry.boss.id] ?? colors.border) : colors.border }]}>
        <BossSprite
          id={entry.boss.id}
          size={72}
          anim={known ? 'defeat' : 'idle'}
          tint={known ? RANK_TINT.at(entry.bestRank!) : 'silhouette'}
        />
      </View>
      <Text style={[typography.body, styles.name]} numberOfLines={2}>
        {name}
      </Text>
      {known ? (
        <>
          <RankGems rank={entry.bestRank!} compact />
          <Text style={styles.meta}>
            {t(entry.wins === 1 ? 'bestiary.winsOne' : 'bestiary.winsMany', { count: entry.wins })}
          </Text>
          <Text style={styles.meta}>
            {t('bestiary.first', { date: formatShortDate(entry.firstWin!, locale) })}
          </Text>
        </>
      ) : (
        <Text style={styles.meta}>{t('bestiary.notYet')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '31.5%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  stage: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  name: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  meta: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
});
