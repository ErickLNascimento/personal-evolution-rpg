import {
  addDays,
  canStartJourney,
  JOURNEY_LENGTHS,
  JOURNEY_PASS_PCT,
  JOURNEY_REWARD,
  journeyProgress,
  startOfWeek,
  weeklyBoss,
  type JourneyLength,
  type LocalDate,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { BossCard } from '@/components/challenges/BossCard';
import { Chips } from '@/components/Chips';
import { CrystalBadge } from '@/components/crystals/Crystals';
import { Button, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import {
  abandonJourney,
  claimBoss,
  fetchChallenges,
  resolveJourney,
  startJourney,
  type ChallengesData,
  type JourneyRecord,
} from '@/features/challenges/api';
import type { HabitRecord } from '@/features/habits/api';
import { useToday } from '@/features/profile/useToday';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';

interface ScreenData extends ChallengesData {
  /** Jornadas que acabaram de ser decididas nesta visita. */
  results: { title: string; status: string; coins: number }[];
}

const STATUS_LABEL: Record<string, string> = {
  won: 'Vencida',
  lost: 'Não concluída',
  abandoned: 'Encerrada',
};

function logsOf(data: ChallengesData, habitId: string): Set<LocalDate> {
  const set = new Set<LocalDate>();
  for (const [date, ids] of data.logged) if (ids.has(habitId)) set.add(date);
  return set;
}

/** Desafios com prazo: o chefe da semana e as jornadas de 21 ou 66 dias. */
export default function ChallengesScreen() {
  const { today, ready } = useToday();

  // Carrega e já fecha no banco as jornadas com resultado decidido (o banco confere e paga).
  const load = useCallback(async () => {
    const first = await fetchChallenges(today);
    if (first.error !== null) return first;
    const decided = first.data.journeys.filter((j) => {
      const habit = first.data.habits.find((h) => h.id === j.habitId);
      return (
        j.status === 'active' &&
        habit &&
        journeyProgress(habit, logsOf(first.data, habit.id), j, today).outcome
      );
    });
    if (decided.length === 0) return { data: { ...first.data, results: [] }, error: null };

    const resolved = await Promise.all(decided.map((j) => resolveJourney(j.id)));
    const results = decided.flatMap((j, i) => {
      const r = resolved[i]!;
      if (r.error !== null || r.data.status === 'active') return [];
      const title = first.data.habits.find((h) => h.id === j.habitId)?.title ?? 'Hábito';
      return [{ title, status: r.data.status, coins: r.data.coins }];
    });
    const again = await fetchChallenges(today);
    if (again.error !== null) return again;
    return { data: { ...again.data, results }, error: null };
  }, [today]);
  const screen = useFocusLoad<ScreenData>(load, ready);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!screen.data) {
    return (
      <StackScreen>
        {screen.error ? (
          <FormMessage text={screen.error} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }
  const data = screen.data;
  const thisWeek = startOfWeek(today);
  const lastWeek = addDays(thisWeek, -7);
  const boss = weeklyBoss(data.habits, data.logged, today, thisWeek);
  const previous = weeklyBoss(data.habits, data.logged, today, lastWeek);
  const active = data.journeys.filter((j) => j.status === 'active');
  const finished = data.journeys.filter((j) => j.status !== 'active').slice(0, 5);
  const habitById = new Map(data.habits.map((h) => [h.id, h]));

  async function claim(week: LocalDate) {
    setBusy(`boss:${week}`);
    setError(null);
    const r = await claimBoss(week);
    setBusy(null);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotice(`Chefe derrotado: +${r.data.coins} Cristais!`);
    screen.refresh();
  }

  return (
    <StackScreen>
      <View style={styles.balance}>
        <CrystalBadge amount={data.crystals} />
      </View>
      {data.results.map((r) => (
        <FormMessage
          key={r.title + r.status}
          tone="info"
          text={
            r.status === 'won'
              ? `🏆 Jornada vencida: ${r.title}! +${r.coins} Cristais.`
              : `A jornada de ${r.title} não chegou à meta desta vez. Que tal tentar de novo?`
          }
        />
      ))}
      {notice ? <FormMessage tone="info" text={notice} /> : null}
      <FormMessage text={error} />

      {previous.defeated && !data.bossClaimed.has(lastWeek) && (
        <BossCard
          label="CHEFE DA SEMANA PASSADA"
          state={previous}
          claimed={false}
          busy={busy === `boss:${lastWeek}`}
          onClaim={() => claim(lastWeek)}
        />
      )}
      <BossCard
        state={boss}
        claimed={data.bossClaimed.has(thisWeek)}
        busy={busy === `boss:${thisWeek}`}
        onClaim={() => claim(thisWeek)}
      />

      <Text style={typography.label}>JORNADAS</Text>
      <Text style={typography.caption}>
        Escolha um hábito e um prazo. Faça-o em {JOURNEY_PASS_PCT}% dos dias da agenda para vencer.
      </Text>
      {active.map((j) => {
        const habit = habitById.get(j.habitId);
        return habit ? (
          <JourneyCard
            key={j.id}
            journey={j}
            habit={habit}
            logged={logsOf(data, habit.id)}
            today={today}
            busy={busy === j.id}
            onAbandon={() =>
              Alert.alert('Encerrar jornada?', 'O progresso desta jornada será perdido.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Encerrar',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(j.id);
                    const r = await abandonJourney(j.id);
                    setBusy(null);
                    if (r.error !== null) setError(r.error);
                    else screen.refresh();
                  },
                },
              ])
            }
          />
        ) : null;
      })}

      <NewJourney
        habits={data.habits.filter((h) => !h.archivedOn)}
        journeys={data.journeys}
        onStart={async (habitId, length) => {
          setError(null);
          const r = await startJourney(habitId, length);
          if (r.error !== null) return r.error;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          screen.refresh();
          return null;
        }}
      />

      {finished.length > 0 && (
        <>
          <Text style={typography.label}>HISTÓRICO</Text>
          {finished.map((j) => (
            <View key={j.id} style={styles.historyRow}>
              <Text style={[typography.body, styles.flex]}>
                {habitById.get(j.habitId)?.title ?? 'Hábito'} · {j.lengthDays} dias
              </Text>
              <Text style={[typography.caption, j.status === 'won' && styles.won]}>
                {STATUS_LABEL[j.status]}
              </Text>
            </View>
          ))}
        </>
      )}
    </StackScreen>
  );
}

function JourneyCard({
  journey,
  habit,
  logged,
  today,
  busy,
  onAbandon,
}: {
  journey: JourneyRecord;
  habit: HabitRecord;
  logged: Set<LocalDate>;
  today: LocalDate;
  busy: boolean;
  onAbandon: () => void;
}) {
  const p = journeyProgress(habit, logged, journey, today);
  const pct = p.required === 0 ? 0 : Math.min(100, (p.done / p.required) * 100);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={[typography.heading, styles.flex]}>{habit.title}</Text>
        <Text style={styles.day}>
          Dia {p.day}/{journey.lengthDays}
        </Text>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityLabel={`${p.done} de ${p.required} dias feitos`}
      >
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={typography.caption}>
        {p.done} de {p.required} dias necessários ·{' '}
        {p.missesLeft === 0
          ? 'nenhuma falta sobrando'
          : `${p.missesLeft} ${p.missesLeft === 1 ? 'falta ainda cabe' : 'faltas ainda cabem'}`}
      </Text>
      <Text style={typography.caption}>Prêmio: +{JOURNEY_REWARD[journey.lengthDays]} Cristais</Text>
      <Button title="Encerrar jornada" variant="secondary" onPress={onAbandon} loading={busy} />
    </View>
  );
}

function NewJourney({
  habits,
  journeys,
  onStart,
}: {
  habits: HabitRecord[];
  journeys: JourneyRecord[];
  onStart: (habitId: string, length: JourneyLength) => Promise<string | null>;
}) {
  const free = habits.filter(
    (h) => !journeys.some((j) => j.status === 'active' && j.habitId === h.id),
  );
  const [habitId, setHabitId] = useState<string | null>(null);
  const [length, setLength] = useState<JourneyLength>(21);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (habits.length === 0)
    return <Text style={typography.caption}>Crie um hábito para começar uma jornada.</Text>;

  const chosen = habitId && free.some((h) => h.id === habitId) ? habitId : null;
  const blocked = chosen ? canStartJourney(chosen, journeys) : canStartJourney('', journeys);

  return (
    <View style={styles.card}>
      <Text style={typography.label}>NOVA JORNADA</Text>
      {free.length === 0 ? (
        <Text style={typography.caption}>Todos os seus hábitos já estão em jornadas.</Text>
      ) : (
        <>
          <Chips
            options={free.map((h) => ({ value: h.id, label: h.title }))}
            selected={chosen ? [chosen] : []}
            onToggle={setHabitId}
          />
          <Chips
            options={JOURNEY_LENGTHS.map((n) => ({
              value: n,
              label: `${n} dias · +${JOURNEY_REWARD[n]}`,
              accessibilityLabel: `${n} dias, prêmio de ${JOURNEY_REWARD[n]} Cristais`,
            }))}
            selected={[length]}
            onToggle={setLength}
          />
          <Text style={typography.caption}>
            {length === 66
              ? '66 dias é o tempo médio para um hábito virar automático.'
              : '21 dias: um primeiro marco para firmar o hábito.'}
          </Text>
          <FormMessage text={error ?? (chosen ? blocked : null)} />
          <Button
            title="Começar jornada"
            loading={saving}
            disabled={!chosen || Boolean(blocked)}
            onPress={async () => {
              if (!chosen) return;
              setSaving(true);
              const e = await onStart(chosen, length);
              setSaving(false);
              setError(e);
              if (!e) setHabitId(null);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { alignItems: 'flex-end' },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  day: { fontWeight: '700', color: colors.primary },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  won: { color: colors.accent, fontWeight: '700' },
});
