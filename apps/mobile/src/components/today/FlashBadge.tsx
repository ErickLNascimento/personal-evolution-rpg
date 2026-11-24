import { Ionicons } from '@expo/vector-icons';
import { FLASH_CRYSTALS, flashBonusXp, flashRemainingMs, formatRemaining } from '@per/domain';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';
import { useT } from '@/i18n';

const AMBER = '#FFB020';

/**
 * Selo da missão relâmpago: contagem regressiva e o bônus em jogo.
 * Concluída com bônus, mostra o bônus garantido; vencida (ou concluída fora do prazo), some.
 */
export function FlashBadge({
  deadline,
  done,
  awarded,
  missionXp,
}: {
  deadline: Date;
  done: boolean;
  /** O banco concedeu o bônus. Enquanto a resposta não chega, vale a concluída dentro do prazo. */
  awarded: boolean;
  missionXp: number;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [done]);

  const remaining = flashRemainingMs(deadline, now);
  const { t, locale } = useT();
  const bonus = t('mission.flashBonus', { xp: flashBonusXp(missionXp), crystals: FLASH_CRYSTALS });
  if (done ? !awarded : remaining === 0) return null;

  return (
    <View
      style={[styles.badge, done && styles.done]}
      accessible
      accessibilityLabel={
        done
          ? t('mission.flashDone', { bonus })
          : t('mission.flashLeft', { time: formatRemaining(remaining, locale), bonus })
      }
    >
      <Ionicons name="flash" size={12} color={done ? colors.accent : AMBER} />
      <Text style={[styles.text, done && { color: colors.accent }]}>
        {done
          ? t('mission.flashDoneShort', { bonus })
          : t('mission.flashShort', { time: formatRemaining(remaining, locale), bonus })}
      </Text>
    </View>
  );
}

export const FLASH_COLOR = AMBER;

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: '#2E2410',
  },
  done: { backgroundColor: '#123026' },
  text: { fontSize: 11, fontWeight: '700', color: AMBER },
});
