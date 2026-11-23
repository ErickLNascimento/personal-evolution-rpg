import { OBJECTIVE_CATEGORY_LABEL } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { FormMessage } from '@/components/Form';
import { useCelebration } from '@/features/celebration/CelebrationProvider';
import {
  completeObjective,
  fetchObjectivesProgress,
  OBJECTIVE_MIN_LOGS,
  type ObjectiveProgress,
} from '@/features/objectives/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

/**
 * Objetivos ativos com o progresso até poder declará-los conquistados.
 * Conquistar concede o título épico da área (uma vez por área) e +100 Cristais.
 */
export function ObjectivesCard() {
  const load = useCallback(() => fetchObjectivesProgress(), []);
  const { data, error, refresh } = useFocusLoad<ObjectiveProgress[]>(load);
  const { celebrateTitles } = useCelebration();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function complete(o: ObjectiveProgress) {
    setBusy(o.id);
    setMessage(null);
    const r = await completeObjective(o.id);
    setBusy(null);
    if (r.error !== null) {
      setMessage(r.error);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (r.data.titleNew) celebrateTitles([r.data.title]);
    else setMessage(`"${o.title}" conquistado! +${r.data.crystals} Cristais.`);
    refresh();
  }

  function confirm(o: ObjectiveProgress) {
    Alert.alert(
      `Conquistou "${o.title}"?`,
      'O objetivo sai da lista de ativos e vira uma conquista sua. Os hábitos ligados a ele continuam como estão.',
      [
        { text: 'Ainda não', style: 'cancel' },
        { text: 'Conquistei!', onPress: () => void complete(o) },
      ],
    );
  }

  if (!data) return error ? <FormMessage text={error} /> : null;
  if (data.length === 0) {
    return (
      <Text style={typography.caption}>Sem objetivos ativos. Crie um ao montar um hábito.</Text>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={typography.caption}>
        Chegou lá de verdade? Com {OBJECTIVE_MIN_LOGS} registros nos hábitos do objetivo, você pode
        declará-lo conquistado e ganhar um título épico.
      </Text>
      <FormMessage text={message} tone="info" />
      {data.map((o) => {
        const ready = o.logs >= OBJECTIVE_MIN_LOGS;
        const pct = Math.min(1, o.logs / OBJECTIVE_MIN_LOGS);
        return (
          <View key={o.id} style={styles.item}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={typography.body}>{o.title}</Text>
                <Text style={typography.caption}>
                  {OBJECTIVE_CATEGORY_LABEL[o.category]} · {Math.min(o.logs, OBJECTIVE_MIN_LOGS)}/
                  {OBJECTIVE_MIN_LOGS} registros
                </Text>
              </View>
              <Pressable
                onPress={() => confirm(o)}
                disabled={!ready || busy !== null}
                accessibilityRole="button"
                accessibilityLabel={
                  ready
                    ? `Conquistei ${o.title}`
                    : `${o.title}: faltam ${OBJECTIVE_MIN_LOGS - o.logs} registros`
                }
                style={({ pressed }) => [
                  styles.button,
                  !ready && styles.buttonLocked,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.buttonText, !ready && styles.buttonTextLocked]}>
                  {busy === o.id
                    ? '…'
                    : ready
                      ? 'Conquistei!'
                      : `Faltam ${OBJECTIVE_MIN_LOGS - o.logs}`}
                </Text>
              </Pressable>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct * 100}%` }, ready && styles.fillReady]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  item: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  button: {
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLocked: { backgroundColor: colors.surfaceRaised },
  buttonText: { fontSize: 13, fontWeight: '900', color: colors.text },
  buttonTextLocked: { color: colors.textSecondary, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  fillReady: { backgroundColor: '#A855F7' },
});
