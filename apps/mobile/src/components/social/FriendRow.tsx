import { Ionicons } from '@expo/vector-icons';
import { socialName } from '@per/domain';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import type { SocialCard, SocialSummary } from '@/features/social/api';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

function isSummary(p: SocialCard | SocialSummary): p is SocialSummary {
  return 'streak' in p;
}

/**
 * Linha de uma pessoa: herói, nome e nível. Com o resumo (amigos e grupo), também streak e
 * missões de hoje. `actions` vai à direita (botões de aceitar, adicionar…).
 */
export function FriendRow({
  person,
  actions,
  onPress,
}: {
  person: SocialCard | SocialSummary;
  actions?: ReactNode;
  onPress?: () => void;
}) {
  const { t, locale } = useT();
  const name = socialName(person.displayName, locale);
  const summary = isSummary(person) ? person : null;
  const allDone =
    summary !== null && summary.todayTotal > 0 && summary.todayDone >= summary.todayTotal;
  const label = summary
    ? t('social.friendA11y', {
        name,
        level: person.level,
        streak: summary.streak,
        done: summary.todayDone,
        total: summary.todayTotal,
      })
    : t('social.cardA11y', { name, level: person.level });

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}
    >
      <View style={styles.avatar}>
        <HeroAvatar hero={person.hero} size={44} />
      </View>
      <View style={styles.body}>
        <Text style={typography.body} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          <Text style={typography.caption}>{t('social.level', { level: person.level })}</Text>
          {summary && (
            <>
              <Ionicons
                name="flame"
                size={13}
                color={summary.streak > 0 ? colors.xp : colors.textSecondary}
              />
              <Text style={typography.caption}>{summary.streak}</Text>
            </>
          )}
        </View>
        {summary && summary.todayTotal > 0 && (
          <View style={styles.today}>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, (summary.todayDone / summary.todayTotal) * 100)}%` },
                ]}
              />
            </View>
            <Text style={[typography.caption, allDone && styles.done]}>
              {t('social.today', { done: summary.todayDone, total: summary.todayTotal })}
            </Text>
          </View>
        )}
      </View>
      {actions}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  avatar: {
    width: 52,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  today: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  done: { color: colors.accent, fontWeight: '700' },
});
