import {
  BRANCH_TIER,
  heroLook,
  PATH_CHANGE_COOLDOWN_DAYS,
  branchLabel,
  pathChangeAvailableAt,
  pathLabel,
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
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

/** Escolher o caminho pela primeira vez, ou trocar de caminho ou de ramo (com espera de 14 dias). */
export default function PathScreen() {
  const { profile, refresh } = useProfile();
  const { t, locale } = useT();
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
          <Text style={typography.label}>{t('pathScreen.current')}</Text>
          <Text style={typography.heading}>
            {pathLabel(current.path, locale)} ·{' '}
            {stageName(current.path, current.branch, current.stage, look.form, locale)}
          </Text>
          <PathTree state={{ ...current, path: current.path }} form={look.form} />
        </View>
      ) : (
        <Text style={typography.body}>{t('pathScreen.intro')}</Text>
      )}

      {availableAt && !first ? (
        <View style={styles.notice}>
          <Text style={typography.body}>
            {t('pathScreen.cooldown', {
              date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(
                availableAt,
              ),
            })}
          </Text>
        </View>
      ) : null}

      {branchChoice && current.path && (
        <View style={styles.section}>
          <Text style={typography.label}>{t('pathScreen.branch')}</Text>
          <Chips
            options={(['A', 'B'] as Branch[]).map((b) => ({
              value: b,
              label: `${branchLabel(current.path!, b, locale)}: ${stageName(current.path!, b, current.stage, look.form, locale)}`,
            }))}
            selected={branch ? [branch] : []}
            onToggle={setBranch}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={typography.label}>{first ? t('pathScreen.choose') : t('pathScreen.others')}</Text>
        {!first && (
          <Text style={typography.caption}>
            {t('pathScreen.changeHint', { days: PATH_CHANGE_COOLDOWN_DAYS })}
          </Text>
        )}
        <PathPicker look={look} value={path} onChoose={setPath} />
      </View>

      <FormMessage text={error} />
      <Button
        title={
          first
            ? t('pathScreen.follow')
            : changed
              ? t('pathScreen.confirm')
              : t('pathScreen.nothing')
        }
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
