import { Ionicons } from '@expo/vector-icons';
import {
  BOSS_REWARD,
  bossText,
  bossTitle,
  rankLabel,
  type BossRank,
  type WeeklyBoss,
} from '@per/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Form';
import { BossSprite, RANK_TINT, useBossAnim } from './BossSprite';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

/** Cor de cada chefe (moldura e detalhes); o desenho vem do BossSprite. */
export const BOSS_COLOR: Record<string, string> = {
  golem: '#A58B6F',
  hidra: '#16C79A',
  lich: '#8B5CF6',
  dragao: '#F2617A',
  sombra: '#6B7280',
  basilisco: '#F5B942',
  kraken: '#2FB5C2',
  quimera: '#E0A040',
  banshee: '#8AAEE0',
  vampiro: '#8A3A9C',
  mimico: '#B8743A',
  medusa: '#55B85E',
  goblin: '#7DB84A',
  slime: '#A95FD9',
  morcego: '#6B5A94',
  diabrete: '#D94545',
  esqueleto: '#E2DBC6',
};

/** Patente em 4 gemas (Soldado = 1 … Lorde = 4), com o nome dela. */
export function RankGems({ rank, compact = false }: { rank: BossRank; compact?: boolean }) {
  const { t, locale } = useT();
  return (
    <View
      style={styles.gems}
      accessible
      accessibilityLabel={t('boss.rankA11y', { rank: rankLabel(rank, locale) })}
    >
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.gem, i <= rank && styles.gemOn]} />
      ))}
      {!compact && <Text style={styles.rankName}>{rankLabel(rank, locale).toUpperCase()}</Text>}
    </View>
  );
}

/** Retrato pequeno do chefe (parado), numa moldura redonda na cor dele. */
export function BossEmblem({ id, size = 56 }: { id: string; size?: number }) {
  return (
    <View
      style={[
        styles.emblem,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: BOSS_COLOR[id] ?? colors.danger,
        },
      ]}
    >
      <BossSprite id={id} size={size * 1.15} />
    </View>
  );
}

interface Props {
  state: WeeklyBoss;
  claimed: boolean;
  busy?: boolean;
  onClaim: () => void;
  /** Rótulo da semana (ex.: "Semana passada"). */
  label?: string;
  /** Cristais do prêmio. */
  reward?: number;
  /** Patente do chefe para a pessoa (sem ela, não mostra patente). */
  rank?: BossRank;
  /** Forma lendária (Lorde do mês): dourado, sem patente. */
  legendary?: boolean;
}

/** Chefe da semana: vida, dano e o resgate do prêmio quando derrotado. */
export function BossCard({
  state,
  claimed,
  busy,
  onClaim,
  label,
  reward = BOSS_REWARD,
  rank,
  legendary = false,
}: Props) {
  const { t, locale } = useT();
  const { boss, maxHp, hp, damage, defeated } = state;
  const pct = maxHp === 0 ? 0 : (hp / maxHp) * 100;
  // Provoca ao abrir com a vida cheia; enfraquece abaixo de 30%; derrotado, dissolve em estrela.
  const sprite = useBossAnim(state, { tauntOnMount: true });

  return (
    <View style={styles.card}>
      <Text style={typography.label}>{label ?? t('boss.weekly')}</Text>
      <View style={styles.header}>
        <View style={[styles.stage, { borderColor: BOSS_COLOR[boss.id] ?? colors.border }]}>
          {maxHp > 0 && (
            <BossSprite
              id={boss.id}
              size={96}
              {...sprite}
              tint={legendary ? 'lorde' : RANK_TINT.at(rank ?? 0)}
            />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={[typography.heading, defeated && styles.defeated]}>
            {bossTitle(boss, rank ?? 0, locale)}
          </Text>
          {rank !== undefined && <RankGems rank={rank} />}
          <Text style={styles.taunt}>
            {defeated ? t('boss.defeated') : `“${bossText(boss, locale).taunt}”`}
          </Text>
        </View>
      </View>

      <View
        style={styles.track}
        accessible
        accessibilityLabel={t('boss.hpLabel', { hp, max: maxHp })}
      >
        <View style={[styles.hp, { width: `${pct}%` }]} />
      </View>
      <Text style={typography.caption}>
        {maxHp === 0
          ? t('boss.noMissions')
          : defeated
            ? t('boss.zeroed', { damage })
            : t('boss.hp', { hp, max: maxHp })}
      </Text>

      {defeated &&
        (claimed ? (
          <Text style={styles.claimed}>{t('boss.claimed', { reward })}</Text>
        ) : (
          <Button title={t('boss.claim', { reward })} onPress={onClaim} loading={busy} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  stage: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mini: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emblem: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: colors.surfaceRaised,
  },
  defeated: { textDecorationLine: 'line-through', color: colors.textSecondary },
  taunt: { ...typography.caption, fontStyle: 'italic' },
  gems: { flexDirection: 'row', alignItems: 'center', gap: 5, marginVertical: 2 },
  gem: {
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: colors.xp,
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  gemOn: { backgroundColor: colors.xp },
  rankName: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.xp, marginLeft: 4 },
  won: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  hp: { height: 10, borderRadius: 5, backgroundColor: colors.danger },
  claimed: { ...typography.caption, color: colors.accent, fontWeight: '700' },
});

/** Atalho compacto para a tela Desafios (sem consultar o banco). */
/**
 * Chefe de uma semana já vencida e com o prêmio resgatado: linha compacta, com o chefe
 * dissolvido em estrela (fica no último quadro da animação de derrota).
 */
export function BossDefeatedRow({
  state,
  label,
  rank,
}: {
  state: WeeklyBoss;
  label: string;
  rank?: BossRank;
}) {
  const { t, locale } = useT();
  const sprite = useBossAnim(state);
  const name = bossTitle(state.boss, rank ?? 0, locale);
  return (
    <View
      style={bannerStyles.banner}
      accessible
      accessibilityLabel={`${label}: ${name}. ${t('boss.defeatedClaimed')}`}
    >
      <View style={[styles.mini, { borderColor: BOSS_COLOR[state.boss.id] ?? colors.border }]}>
        <BossSprite id={state.boss.id} size={56} {...sprite} tint={RANK_TINT.at(rank ?? 0)} />
      </View>
      <View style={styles.flex}>
        <Text style={typography.label}>{label}</Text>
        <Text style={[typography.body, styles.defeated]}>{name}</Text>
        <Text style={styles.won}>{t('boss.defeatedClaimed')}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
    </View>
  );
}

export function BossBanner({
  id,
  name,
  onPress,
  hits = 0,
  rank = 0,
}: {
  id: string;
  name: string;
  onPress: () => void;
  /** Sobe a cada missão concluída: o chefe leva um golpe. */
  hits?: number;
  /** Patente do chefe (muda a cor). */
  rank?: BossRank;
}) {
  const { t } = useT();
  const sprite = useBossAnim({ maxHp: 1, hp: 1, defeated: false }, { hits });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('boss.banner', { name })}
      style={({ pressed }) => [bannerStyles.banner, pressed && bannerStyles.pressed]}
    >
      <View style={[styles.mini, { borderColor: BOSS_COLOR[id] ?? colors.border }]}>
        <BossSprite id={id} size={56} {...sprite} tint={RANK_TINT.at(rank)} />
      </View>
      <View style={styles.flex}>
        <Text style={typography.label}>{t('boss.weekly')}</Text>
        <Text style={typography.body}>{name}</Text>
      </View>
      <Text style={bannerStyles.link}>{t('boss.challenges')}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  link: { fontWeight: '700', color: colors.primary },
});
