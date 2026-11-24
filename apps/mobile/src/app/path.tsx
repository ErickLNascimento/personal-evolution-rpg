import {
  BRANCH_TIER,
  heroLook,
  PATH_CHANGE_COOLDOWN_DAYS,
  PATH_INFO,
  pathChangeAvailableAt,
  stageName,
  type Branch,
  type PathId,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, FormMessage } from '@/components/Form';
import { PathPicker } from '@/components/hero/PathPicker';
import { PathTree } from '@/components/hero/PathTree';
import { StackScreen } from '@/components/Screen';
import { useHero } from '@/features/hero/useHero';
import { choosePath } from '@/features/hero/pathApi';
import { useProfile } from '@/features/profile/ProfileProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const DATE = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });

/** Escolher o caminho pela primeira vez, ou trocar de caminho ou de ramo (com espera de 14 dias). */
export default function PathScreen() {
  const { profile, refresh } = useProfile();
  const { level } = useHero();
  const current = profile?.heroPath;
  const [path, setPath] = useState<PathId | null>(current?.path ?? null);
  const [branch, setBranch] = useState<Branch | null>(current?.branch ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  if (!profile || !current) {
    return (
      <StackScreen>
        <ActivityIndicator color={colors.primary} />
      </StackScreen>
    );
  }

  const look = heroLook(profile.hero, level.level, current, profile.race, profile.cosmetics);
  const first = current.path === null;
  const availableAt = pathChangeAvailableAt(profile.pathChangedAt, now);
  const samePath = path === current.path;
  const branchChoice = samePath && current.stage >= BRANCH_TIER;
  const changed = !samePath || (branchChoice && branch !== current.branch);

  async function confirm() {
    if (!path) return;
    setSaving(true);
    setError(null);
    const r = await choosePath(path, samePath ? branch : null);
    if (r.error !== null) {
      setSaving(false);
      setError(r.error);
      return;
    }
    await refresh();
    setSaving(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <StackScreen>
      {current.path ? (
        <View style={styles.card}>
          <Text style={typography.label}>CAMINHO ATUAL</Text>
          <Text style={typography.heading}>
            {PATH_INFO[current.path].label} ·{' '}
            {stageName(current.path, current.branch, current.stage, look.form)}
          </Text>
          <PathTree state={{ ...current, path: current.path }} form={look.form} />
        </View>
      ) : (
        <Text style={typography.body}>
          Seu caminho define como o herói evolui. Cada caminho cuida de uma área da sua vida: as
          missões dessa área contam para as promoções.
        </Text>
      )}

      {availableAt && !first ? (
        <View style={styles.notice}>
          <Text style={typography.body}>
            Você trocou há pouco. A próxima troca fica liberada em {DATE.format(availableAt)}.
          </Text>
        </View>
      ) : null}

      {branchChoice && current.path && (
        <View style={styles.section}>
          <Text style={typography.label}>RAMO</Text>
          <Chips
            options={(['A', 'B'] as Branch[]).map((b) => ({
              value: b,
              label: `${PATH_INFO[current.path!].branches[b].label}: ${stageName(current.path!, b, current.stage, look.form)}`,
            }))}
            selected={branch ? [branch] : []}
            onToggle={setBranch}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={typography.label}>{first ? 'ESCOLHA SEU CAMINHO' : 'OUTROS CAMINHOS'}</Text>
        {!first && (
          <Text style={typography.caption}>
            Ao trocar, o nível continua o mesmo e o estágio é recalculado pelas missões que você já
            fez nas áreas do novo caminho. Trocas têm {PATH_CHANGE_COOLDOWN_DAYS} dias de espera.
          </Text>
        )}
        <PathPicker look={look} value={path} onChoose={setPath} />
      </View>

      <FormMessage text={error} />
      <Button
        title={first ? 'Seguir este caminho' : changed ? 'Confirmar troca' : 'Nada para trocar'}
        onPress={confirm}
        loading={saving}
        disabled={!path || (!first && (!changed || Boolean(availableAt)))}
      />
    </StackScreen>
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
  notice: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.xp,
  },
  section: { gap: spacing.sm },
});
