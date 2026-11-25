import type { DayProgress, HeroLook, LevelProgress } from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { BOSS_COLOR } from '@/components/challenges/BossCard';
import { BossSprite, useBossAnim } from '@/components/challenges/BossSprite';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { colors, radius, spacing } from '@/theme/tokens';
import { DayRing } from './DayRing';
import { useT } from '@/i18n';

/**
 * Barra fina que aparece no topo quando o card do herói sai da tela ao rolar:
 * herói, nível, XP, o anel do dia e o chefe da semana continuam à vista enquanto se percorre a
 * lista. A cada missão concluída o herói comemora e o chefe leva o golpe, mesmo com o cartão do
 * chefe fora da tela.
 * A animação roda na thread de UI (segue o dedo sem travar).
 */
export function CompactHeroBar({
  hero,
  level,
  progress,
  scrollY,
  showAfter = 150,
  cheer = 0,
  bossId,
}: {
  hero: HeroLook;
  level: LevelProgress;
  progress: DayProgress;
  scrollY: SharedValue<number>;
  /** Rolagem (em dp) a partir da qual a barra entra. */
  showAfter?: number;
  /** Sobe a cada missão concluída: o herói da barra também comemora. */
  cheer?: number;
  /** Chefe da semana (sem ele, a barra não mostra o chefe). */
  bossId?: string | null;
}) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(scrollY.value, [showAfter, showAfter + 50], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ translateY: (t - 1) * 12 }] };
  });
  const pct = Math.round(level.progress * 100);
  const { t } = useT();
  return (
    <Animated.View
      style={[styles.bar, style]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.avatar}>
        <HeroAvatar hero={hero} size={30} cheer={cheer} />
      </View>
      <View style={styles.info}>
        <Text style={styles.level}>{t('hero.level', { level: level.level })}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      {bossId ? <MiniBoss id={bossId} hits={cheer} /> : null}
      <DayRing progress={progress} size={36} stroke={4} />
    </Animated.View>
  );
}

/** Chefe pequeno na barra: provoca parado e leva o golpe a cada missão concluída. */
function MiniBoss({ id, hits }: { id: string; hits: number }) {
  const sprite = useBossAnim({ maxHp: 1, hp: 1, defeated: false }, { hits });
  return (
    <View style={[styles.boss, { borderColor: BOSS_COLOR[id] ?? colors.border }]}>
      <BossSprite id={id} size={40} {...sprite} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 32,
    height: 40,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
  },
  info: { flex: 1, gap: 4 },
  boss: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  level: { fontSize: 14, fontWeight: '700', color: colors.text },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.xp },
});
