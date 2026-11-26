import {
  duoGoalText,
  duoPhase,
  OBJECTIVE_CATEGORY_LABELS,
  socialName,
  type LocalDate,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { PillButton } from '@/components/social/PillButton';
import {
  cancelDuoQuest,
  claimDuoQuest,
  respondDuoQuest,
  type DuoQuest,
} from '@/features/duo/api';
import type { Result } from '@/features/habits/api';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export const DUO_COLOR = '#38BDF8';

function Bar({ who, done, target }: { who: string; done: number; target: number }) {
  const { t } = useT();
  const full = done >= target;
  return (
    <View
      style={styles.bar}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('duo.progressA11y', { who, done, target })}
      accessibilityValue={{ min: 0, max: target, now: done }}
    >
      <Text style={styles.who} numberOfLines={1}>
        {who}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, (done / target) * 100)}%` },
            full && styles.fillDone,
          ]}
        />
      </View>
      <Text style={[typography.caption, full && styles.doneText]}>
        {done}/{target}
      </Text>
    </View>
  );
}

/**
 * Uma missão em equipe: parceiro, meta, o placar dos dois e a ação do momento (aceitar, cancelar
 * o convite ou resgatar). `onChanged` recebe os Cristais ganhos num resgate.
 */
export function DuoQuestRow({
  quest,
  today,
  onChanged,
}: {
  quest: DuoQuest;
  today: LocalDate;
  onChanged: (coins?: number) => void;
}) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phase = duoPhase(quest, today);
  const name = socialName(quest.partner.displayName, locale);
  const goal = duoGoalText(
    quest.target,
    quest.category,
    (c) => OBJECTIVE_CATEGORY_LABELS[locale][c],
    locale,
  );

  async function run<T>(key: string, action: () => Promise<Result<T>>, coins?: (d: T) => number) {
    setBusy(key);
    setError(null);
    const r = await action();
    setBusy(null);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChanged(coins?.(r.data));
  }

  const status =
    phase === 'invited'
      ? t('duo.invitedBy', { name })
      : phase === 'waiting'
        ? t('duo.waiting', { name })
        : t('duo.with', { name });

  const note =
    phase === 'claimed'
      ? t('duo.claimed', { reward: quest.reward })
      : phase === 'over'
        ? t('duo.over')
        : phase === 'active' && quest.myDone >= quest.target
          ? t('duo.almost', { name })
          : phase === 'active' && quest.partnerDone >= quest.target
            ? t('duo.partnerAhead', { name })
            : phase === 'active' || phase === 'waiting' || phase === 'invited'
              ? t('duo.endsSunday')
              : null;

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <HeroAvatar hero={quest.partner.hero} size={36} />
        </View>
        <View style={styles.flex}>
          <Text style={typography.body} numberOfLines={2}>
            {status}
          </Text>
          <Text style={styles.goal}>
            {goal} · {t('duo.reward', { reward: quest.reward })}
          </Text>
        </View>
      </View>

      {(phase === 'active' || phase === 'claimable' || phase === 'claimed') && (
        <View style={styles.bars}>
          <Bar who={t('duo.you')} done={quest.myDone} target={quest.target} />
          <Bar who={name} done={quest.partnerDone} target={quest.target} />
        </View>
      )}

      {note && <Text style={typography.caption}>{note}</Text>}
      <FormMessage text={error} />

      {phase === 'invited' && (
        <View style={styles.actions}>
          <PillButton
            title={t('social.accept')}
            loading={busy === 'accept'}
            disabled={busy !== null}
            onPress={() => void run('accept', () => respondDuoQuest(quest.id, true))}
          />
          <PillButton
            title={t('social.decline')}
            tone="secondary"
            loading={busy === 'decline'}
            disabled={busy !== null}
            onPress={() => void run('decline', () => respondDuoQuest(quest.id, false))}
          />
        </View>
      )}
      {phase === 'waiting' && (
        <View style={styles.actions}>
          <PillButton
            title={t('duo.cancel')}
            tone="secondary"
            loading={busy === 'cancel'}
            onPress={() => void run('cancel', () => cancelDuoQuest(quest.id))}
          />
        </View>
      )}
      {phase === 'claimable' && (
        <View style={styles.actions}>
          <PillButton
            title={t('duo.claim', { reward: quest.reward })}
            loading={busy === 'claim'}
            onPress={() => void run('claim', () => claimDuoQuest(quest.id), (d) => d.coins)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flex: { flex: 1, gap: 2 },
  goal: { ...typography.caption, color: DUO_COLOR, fontWeight: '700' },
  bars: { gap: spacing.xs },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  who: { ...typography.caption, width: 72 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: DUO_COLOR },
  fillDone: { backgroundColor: colors.accent },
  doneText: { color: colors.accent, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
