import {
  heroTier,
  stageName,
  type HeroPathState,
  levelTitleId,
  nextUnlock,
  RARITY_COLOR,
  titleInfo,
  titleName,
  type HeroLook,
  type LevelProgress,
  type TitleId,
} from '@per/domain';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CrystalBadge } from '@/components/crystals/Crystals';
import { XpBar } from '@/components/XpBar';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { HeroAvatar } from './HeroAvatar';

/** Cores da moldura por faixa de título (Aprendiz → Lenda). */
export const TIER_COLORS = ['#3A3F4E', '#16C79A', '#3D7BFF', '#8B5CF6', '#F5B942', '#FF5E7E'];

export function tierColor(level: number): string {
  return TIER_COLORS[Math.min(heroTier(level), TIER_COLORS.length - 1)]!;
}

/** Herói + nível + barra de XP + próximo desbloqueio. Toque para personalizar. */
export function HeroCard({
  hero,
  level,
  name,
  unset,
  onPress,
  crystals,
  heroPath,
  titleId,
  cheer,
  aside,
}: {
  hero: HeroLook;
  level: LevelProgress;
  name: string | null;
  unset: boolean;
  onPress: () => void;
  /** Saldo de Cristais. */
  crystals?: number;
  /** Caminho e estágio: dão o nome da classe (ex.: "Lutadora"). */
  heroPath?: HeroPathState;
  /** Título exibido (escolhido ou o de nível); padrão: o de nível. */
  titleId?: TitleId;
  /** Sobe a cada missão concluída: o herói comemora. */
  cheer?: number;
  /** Conteúdo à direita do retrato e do nome (ex.: o anel do dia). */
  aside?: ReactNode;
}) {
  const shownTitle = titleId ?? levelTitleId(level.level);
  const titleColor = RARITY_COLOR[titleInfo(shownTitle).rarity];
  const next = nextUnlock(level.level, hero.form);
  const frame = tierColor(level.level);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unset
          ? 'Criar seu herói'
          : `Seu herói, ${titleName(shownTitle, hero.form)}, nível ${level.level}. Toque para personalizar.`
      }
      style={({ pressed }) => [styles.card, { borderColor: frame }, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={[styles.portrait, { borderColor: frame }]}>
          <HeroAvatar hero={hero} size={84} animated cheer={cheer} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.title, { color: titleColor }]}>
            {titleName(shownTitle, hero.form).toUpperCase()}
          </Text>
          <Text style={typography.heading} numberOfLines={1}>
            {name ?? 'Herói sem nome'}
          </Text>
          <Text style={typography.caption}>
            {heroPath?.path
              ? stageName(heroPath.path, heroPath.branch, heroPath.stage, hero.form)
              : 'Sem caminho'}
          </Text>
          {unset && <Text style={styles.cta}>Toque para criar seu herói ›</Text>}
          {crystals !== undefined && (
            <View style={styles.wallet}>
              <CrystalBadge amount={crystals} />
            </View>
          )}
        </View>
        {aside}
      </View>
      <XpBar progress={level} />
      {next && (
        <Text style={typography.caption}>
          No nível {next.level}: {next.label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  portrait: {
    width: 96,
    height: 110,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  cta: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
});
