import { duoPhase, sortDuoQuests, type LocalDate } from '@per/domain';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { DUO_COLOR, DuoQuestRow } from '@/components/duo/DuoQuestRow';
import type { DuoQuest } from '@/features/duo/api';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * Tela Hoje: missões em equipe que ainda importam (convite a responder, prêmio a resgatar, em
 * andamento ou esperando o amigo). Resgatadas e encerradas ficam só na Fogueira.
 */
export function DuoQuestsCard({
  quests,
  today,
  onChanged,
}: {
  quests: readonly DuoQuest[];
  today: LocalDate;
  onChanged: (coins?: number) => void;
}) {
  const { t } = useT();
  const shown = sortDuoQuests(
    quests.filter((q) => {
      const p = duoPhase(q, today);
      return p !== 'claimed' && p !== 'over';
    }),
    today,
  );
  if (shown.length === 0) return null;
  return (
    <Animated.View entering={FadeIn.duration(250)} layout={LinearTransition} style={styles.card}>
      <Text style={styles.kicker}>{t('duo.kicker')}</Text>
      <View style={styles.list}>
        {shown.map((q) => (
          <DuoQuestRow key={q.id} quest={q} today={today} onChanged={onChanged} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: `${DUO_COLOR}88`,
    backgroundColor: colors.surface,
  },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: DUO_COLOR },
  list: { gap: spacing.sm },
});
