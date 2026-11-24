import { Ionicons } from '@expo/vector-icons';
import { BOSS_REWARD, type WeeklyBoss } from '@per/domain';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Form';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Aparência de cada chefe (o domínio só define nome e frase). */
export const BOSS_LOOK: Record<string, { icon: IconName; color: string }> = {
  golem: { icon: 'cube', color: '#A58B6F' },
  hidra: { icon: 'git-network', color: '#16C79A' },
  lich: { icon: 'skull', color: '#8B5CF6' },
  dragao: { icon: 'flame', color: '#F2617A' },
  sombra: { icon: 'cloudy-night', color: '#6B7280' },
  basilisco: { icon: 'phone-portrait', color: '#F5B942' },
};

export function BossEmblem({ id, size = 56 }: { id: string; size?: number }) {
  const look = BOSS_LOOK[id] ?? { icon: 'skull' as IconName, color: colors.danger };
  return (
    <View
      style={[
        styles.emblem,
        { width: size, height: size, borderRadius: size / 2, borderColor: look.color },
      ]}
    >
      <Ionicons name={look.icon} size={size * 0.5} color={look.color} />
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
}

/** Chefe da semana: vida, dano e o resgate do prêmio quando derrotado. */
export function BossCard({ state, claimed, busy, onClaim, label = 'CHEFE DA SEMANA' }: Props) {
  const { boss, maxHp, hp, damage, defeated } = state;
  const pct = maxHp === 0 ? 0 : (hp / maxHp) * 100;

  return (
    <View style={styles.card}>
      <Text style={typography.label}>{label}</Text>
      <View style={styles.header}>
        <BossEmblem id={boss.id} />
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
          <Text style={styles.claimed}>Prêmio resgatado: +{BOSS_REWARD} Cristais</Text>
        ) : (
          <Button title={`Resgatar +${BOSS_REWARD} Cristais`} onPress={onClaim} loading={busy} />
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
}: {
  id: string;
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chefe da semana: ${name}. Abrir desafios`}
      style={({ pressed }) => [bannerStyles.banner, pressed && bannerStyles.pressed]}
    >
      <BossEmblem id={id} size={36} />
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
