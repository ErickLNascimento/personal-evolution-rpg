import { Ionicons } from '@expo/vector-icons';
import {
  BRANCH_TIER,
  heroLook,
  PATH_INFO,
  pathLine,
  stageName,
  lookAtStage,
  type Branch,
  type HeroLook,
  type PathId,
  type Tier,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Button, FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { StackScreen } from '@/components/Screen';
import { useHero } from '@/features/hero/useHero';
import { fetchHeroPath, promoteHero, type HeroPathInfo } from '@/features/hero/pathApi';
import { useProfile } from '@/features/profile/ProfileProvider';
import { syncReminders } from '@/lib/reminders';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Cerimônia de promoção: mostra o próximo estágio (e, no 3, a escolha do ramo) e promove. */
export default function PromotionScreen() {
  const load = useCallback(() => fetchHeroPath(), []);
  const info = useFocusLoad<HeroPathInfo>(load);
  const { profile } = useProfile();
  const { level } = useHero();

  if (!info.data || !profile) {
    return (
      <StackScreen>
        {info.error ? (
          <FormMessage text={info.error} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }
  const look = heroLook(profile.hero, level.level, profile.heroPath, profile.race, profile.cosmetics);
  return <Ceremony info={info.data} look={look} />;
}

function Ceremony({ info, look }: { info: HeroPathInfo; look: HeroLook }) {
  const { refresh } = useProfile();
  const [branch, setBranch] = useState<Branch | null>(info.branch);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ stage: Tier; branch: Branch | null } | null>(null);
  const path = info.path;

  if (!path || !info.next) {
    return (
      <StackScreen>
        <Text style={typography.body}>
          {path ? 'Seu herói já está no estágio máximo.' : 'Escolha um caminho primeiro.'}
        </Text>
        <Button title="Voltar" onPress={() => router.back()} variant="secondary" />
      </StackScreen>
    );
  }

  const nextTier = info.next.tier;
  const choosingBranch = nextTier === BRANCH_TIER;

  async function promote() {
    setSaving(true);
    setError(null);
    const r = await promoteHero(choosingBranch ? branch : null);
    if (r.error !== null) {
      setSaving(false);
      setError(r.error);
      return;
    }
    await refresh();
    setSaving(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void syncReminders().catch(() => undefined); // tira o aviso de promoção pendente
    setDone(r.data);
  }

  if (done) {
    const newLook = lookAtStage(look, path, done.branch, done.stage);
    return (
      <StackScreen>
        <View style={styles.center}>
          <Animated.View entering={ZoomIn.springify().damping(10)}>
            <HeroAvatar hero={newLook} size={170} animated entrance="levelup" />
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(500)} style={styles.kicker}>
            PROMOÇÃO
          </Animated.Text>
          <Animated.Text
            entering={FadeIn.delay(700)}
            style={styles.newName}
            accessibilityRole="header"
          >
            {stageName(path, done.branch, done.stage, look.form)}
          </Animated.Text>
          <Text style={[typography.body, styles.centerText]}>
            Seu herói subiu para o estágio {done.stage} do caminho {PATH_INFO[path].label}.
          </Text>
        </View>
        <Button title="Continuar" onPress={() => router.back()} />
      </StackScreen>
    );
  }

  if (!info.canPromote) {
    return (
      <StackScreen>
        <Text style={typography.heading}>Ainda não é hora</Text>
        <Text style={typography.body}>
          Para virar {stageName(path, info.branch ?? 'A', nextTier, look.form)}: nível{' '}
          {info.next.minLevel} e {info.next.minMissions} missões nas áreas do caminho. Você tem
          nível {info.level} e {info.areaMissions} missões.
        </Text>
        <Button title="Voltar" onPress={() => router.back()} variant="secondary" />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <View style={styles.center}>
        <HeroAvatar hero={look} size={120} animated />
        <Text style={styles.kicker}>PROMOÇÃO DISPONÍVEL</Text>
        <Text style={[typography.body, styles.centerText]}>
          {stageName(path, info.branch, info.stage, look.form)} → próximo estágio do caminho{' '}
          {PATH_INFO[path].label}
        </Text>
      </View>

      {choosingBranch ? (
        <View style={styles.branches}>
          <Text style={typography.label}>ESCOLHA SEU RAMO</Text>
          <Text style={typography.caption}>
            Dá para trocar de ramo depois, com 14 dias de espera entre trocas.
          </Text>
          {(['A', 'B'] as Branch[]).map((b) => (
            <BranchCard
              key={b}
              path={path}
              branch={b}
              look={look}
              active={branch === b}
              onPress={() => setBranch(b)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.next}>
          <Ionicons name="arrow-up-circle" size={22} color={colors.xp} />
          <Text style={typography.heading}>
            {stageName(path, info.branch, nextTier, look.form)}
          </Text>
        </View>
      )}

      <FormMessage text={error} />
      <Button
        title="Aceitar promoção"
        onPress={promote}
        loading={saving}
        disabled={choosingBranch && !branch}
      />
    </StackScreen>
  );
}

function BranchCard({
  path,
  branch,
  look,
  active,
  onPress,
}: {
  path: PathId;
  branch: Branch;
  look: HeroLook;
  active: boolean;
  onPress: () => void;
}) {
  const line = pathLine(path, branch, look.form).slice(BRANCH_TIER);
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${PATH_INFO[path].branches[branch].label}: ${line.join(', ')}`}
      style={({ pressed }) => [
        styles.branchCard,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <HeroAvatar
        hero={{ ...lookAtStage(look, path, branch, BRANCH_TIER), aura: 'nenhuma' }}
        size={56}
      />
      <View style={styles.flex}>
        <Text style={styles.branchName}>
          {PATH_INFO[path].branches[branch].label.toUpperCase()}
        </Text>
        <Text style={typography.heading}>{line[0]}</Text>
        <Text style={typography.caption}>{line.join(' → ')}</Text>
      </View>
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={active ? colors.primary : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  centerText: { textAlign: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, color: colors.xp },
  newName: { fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center' },
  branches: { gap: spacing.sm },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  active: { borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  flex: { flex: 1, gap: 2 },
  branchName: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textSecondary },
});
