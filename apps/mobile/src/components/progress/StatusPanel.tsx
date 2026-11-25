import { Ionicons } from '@expo/vector-icons';
import {
  stageName,
  titleName,
  RARITY_COLOR,
  titleInfo,
  type HeroLook,
  type HeroPathState,
  type LevelProgress,
  type TitleId,
} from '@per/domain';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { tierColor } from '@/components/hero/HeroCard';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface StatGem {
  icon: IconName;
  color: string;
  value: string;
  label: string;
}

/**
 * Topo da aba Progresso: retrato, título, classe, nível com a barra de XP e as gemas de status
 * (ex.: sequência, escudos, XP total). Toque abre a tela do herói.
 */
export function StatusPanel({
  hero,
  heroPath,
  level,
  name,
  titleId,
  gems,
}: {
  hero: HeroLook;
  heroPath?: HeroPathState;
  level: LevelProgress;
  name: string | null;
  titleId: TitleId;
  gems: readonly StatGem[];
}) {
  const { t, locale } = useT();
  const frame = tierColor(level.level);
  const pct = Math.round(level.progress * 100);
  const cls = heroPath?.path
    ? stageName(heroPath.path, heroPath.branch, heroPath.stage, hero.form, locale)
    : t('hero.noPath');

  return (
    <View style={[styles.panel, { borderColor: `${frame}AA` }]}>
      <Pressable
        onPress={() => router.push('/hero')}
        accessibilityRole="button"
        accessibilityLabel={t('statusPanel.a11y', { name: name ?? t('hero.noName'), cls, level: level.level })}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}
      >
        <View style={[styles.portrait, { borderColor: frame }]}>
          <HeroAvatar hero={hero} size={60} animated />
        </View>
        <View style={styles.info}>
          <Text style={[styles.title, { color: RARITY_COLOR[titleInfo(titleId).rarity] }]} numberOfLines={1}>
            {titleName(titleId, hero.form, locale).toUpperCase()}
          </Text>
          <Text style={typography.heading} numberOfLines={1}>
            {name ?? t('hero.noName')}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {cls} · {t('hero.level', { level: level.level })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>

      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('hero.xpToNext', { xp: level.xpToNextLevel })}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
      >
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.xp }]} />
      </View>
      <Text style={styles.xpText}>
        {t('statusPanel.xp', {
          into: level.xpIntoLevel,
          total: level.xpIntoLevel + level.xpToNextLevel,
          next: level.level + 1,
        })}
      </Text>

      <View style={styles.gems}>
        {gems.map((g) => (
          <View key={g.label} style={styles.stat} accessible accessibilityLabel={`${g.label}: ${g.value}`}>
            <View style={[styles.gem, { borderColor: g.color, backgroundColor: `${g.color}1F` }]}>
              <View style={styles.gemIcon}>
                <Ionicons name={g.icon} size={16} color={g.color} />
              </View>
            </View>
            <Text style={styles.statValue}>{g.value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {g.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.8 },
  portrait: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  info: { flex: 1, gap: 1 },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  xpText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  gems: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  gem: {
    width: 26,
    height: 26,
    borderWidth: 1.5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    marginBottom: 2,
  },
  gemIcon: { transform: [{ rotate: '-45deg' }] },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
});
