import { Ionicons } from '@expo/vector-icons';
import { BOSS_REWARD, type WeeklyBoss } from '@per/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Form';
import { BossSprite, useBossAnim } from './BossSprite';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Cor de cada chefe (moldura e detalhes); o desenho vem do BossSprite. */
export const BOSS_COLOR: Record<string, string> = {
  golem: '#A58B6F',
  hidra: '#16C79A',
  lich: '#8B5CF6',
  dragao: '#F2617A',
  sombra: '#6B7280',
  basilisco: '#F5B942',
};

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
}

/** Chefe da semana: vida, dano e o resgate do prêmio quando derrotado. */
export function BossCard({
  state,
  claimed,
  busy,
  onClaim,
  label = 'CHEFE DA SEMANA',
  reward = BOSS_REWARD,
}: Props) {
  const { boss, maxHp, hp, damage, defeated } = state;
  const pct = maxHp === 0 ? 0 : (hp / maxHp) * 100;
  // Provoca ao abrir com a vida cheia; enfraquece abaixo de 30%; derrotado, dissolve em estrela.
  const sprite = useBossAnim(state, { tauntOnMount: true });

  return (
    <View style={styles.card}>
      <Text style={typography.label}>{label}</Text>
      <View style={styles.header}>
        <View style={[styles.stage, { borderColor: BOSS_COLOR[boss.id] ?? colors.border }]}>
          {maxHp > 0 && <BossSprite id={boss.id} size={96} {...sprite} />}
        </View>
        <View style={styles.flex}>
          <Text style={[typography.heading, defeated && styles.defeated]}>{boss.name}</Text>
          <Text style={styles.taunt}>
            {defeated ? 'Derrotado! Sua rotina venceu.' : `“${boss.taunt}”`}
          </Text>
        </View>
      </View>

      <View style={styles.track} accessible accessibilityLabel={`Vida do chefe: ${hp} de ${maxHp}`}>
        <View style={[styles.hp, { width: `${pct}%` }]} />
      </View>
      <Text style={typography.caption}>
        {maxHp === 0
          ? 'Sem missões na agenda desta semana: o chefe não apareceu.'
          : defeated
            ? `${damage} missões feitas. Vida zerada!`
            : `Vida ${hp}/${maxHp}. Cada missão feita tira 1 de vida.`}
      </Text>

      {defeated &&
        (claimed ? (
          <Text style={styles.claimed}>Prêmio resgatado: +{reward} Cristais</Text>
        ) : (
          <Button title={`Resgatar +${reward} Cristais`} onPress={onClaim} loading={busy} />
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
export function BossBanner({
  id,
  name,
  onPress,
  hits = 0,
}: {
  id: string;
  name: string;
  onPress: () => void;
  /** Sobe a cada missão concluída: o chefe leva um golpe. */
  hits?: number;
}) {
  const sprite = useBossAnim({ maxHp: 1, hp: 1, defeated: false }, { hits });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chefe da semana: ${name}. Abrir desafios`}
      style={({ pressed }) => [bannerStyles.banner, pressed && bannerStyles.pressed]}
    >
      <View style={[styles.mini, { borderColor: BOSS_COLOR[id] ?? colors.border }]}>
        <BossSprite id={id} size={56} {...sprite} />
      </View>
      <View style={styles.flex}>
        <Text style={typography.label}>CHEFE DA SEMANA</Text>
        <Text style={typography.body}>{name}</Text>
      </View>
      <Text style={bannerStyles.link}>Desafios</Text>
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
