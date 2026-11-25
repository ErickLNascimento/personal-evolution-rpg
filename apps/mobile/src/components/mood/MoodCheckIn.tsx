import {
  cleanMoodInput,
  moodLabel,
  MOOD_NOTE_MAX,
  moodTagLabel,
  MOOD_TAGS,
  MOODS,
  type LocalDate,
  type Mood,
  type MoodEntry,
  type MoodTag,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import type { Result } from '@/features/habits/api';
import { fetchMoodEntries, saveMoodEntry } from '@/features/mood/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { MoodFace } from './MoodFace';
import { useT } from '@/i18n';


/**
 * "Como você está hoje?": um toque registra o humor do dia; sentimentos e nota são opcionais.
 * O primeiro registro do dia rende Cristais. Só o próprio usuário vê.
 */
export function MoodCheckIn({ date, isToday }: { date: LocalDate; isToday: boolean }) {
  const { t, locale } = useT();
  const tagOptions = MOOD_TAGS.map((tag) => ({ value: tag, label: moodTagLabel(tag, locale) }));
  const load = useCallback(async (): Promise<Result<MoodEntry | null>> => {
    const r = await fetchMoodEntries(date);
    if (r.error !== null) return r;
    return { data: r.data.find((e) => e.date === date) ?? null, error: null };
  }, [date]);
  const saved = useFocusLoad<MoodEntry | null>(load);
  // Rascunho local (o que o usuário está escolhendo); some ao trocar de dia.
  const [draft, setDraft] = useState<{
    date: LocalDate;
    mood: Mood | null;
    tags: MoodTag[];
    note: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

  if (saved.error && !saved.data) return null; // sem a migration ou sem rede: não atrapalha a tela
  const entry = saved.data ?? null;
  const current =
    draft?.date === date
      ? draft
      : { date, mood: entry?.mood ?? null, tags: entry?.tags ?? [], note: entry?.note ?? '' };

  async function save(next: typeof current) {
    if (next.mood === null) return;
    const clean = cleanMoodInput(next.tags, next.note, locale);
    if (clean.error) {
      setMessage({ text: clean.error, tone: 'error' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const r = await saveMoodEntry(date, next.mood, clean.tags, clean.note);
    setBusy(false);
    if (r.error !== null) {
      setMessage({ text: r.error, tone: 'error' });
      return;
    }
    void Haptics.selectionAsync();
    setMessage({
      text: r.data.coins > 0 ? t('mood.savedCoins', { coins: r.data.coins }) : t('mood.saved'),
      tone: 'info',
    });
    saved.setData({ date, mood: next.mood, tags: clean.tags, note: clean.note });
    setDraft(null);
  }

  return (
    <View style={styles.card}>
      <Text style={typography.label}>{isToday ? t('mood.today') : t('mood.yesterday')}</Text>
      <View style={styles.faces} accessibilityRole="radiogroup">
        {MOODS.map((m) => {
          const selected = current.mood === m;
          return (
            <Pressable
              key={m}
              onPress={() => {
                const next = { ...current, mood: m };
                setDraft(next);
                void save(next);
              }}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={moodLabel(m, locale)}
              style={({ pressed }) => [
                styles.face,
                selected && styles.faceSelected,
                pressed && styles.pressed,
              ]}
            >
              <MoodFace mood={m} size={40} dim={current.mood !== null && !selected} />
            </Pressable>
          );
        })}
      </View>
      {current.mood !== null && (
        <Text style={[typography.caption, styles.center]}>{moodLabel(current.mood, locale)}</Text>
      )}
      {message && <FormMessage tone={message.tone} text={message.text} />}

      {current.mood !== null &&
        (expanded ? (
          <View style={styles.details}>
            <Chips
              multiple
              options={tagOptions}
              selected={current.tags}
              onToggle={(t) =>
                setDraft({
                  ...current,
                  tags: current.tags.includes(t)
                    ? current.tags.filter((x) => x !== t)
                    : [...current.tags, t],
                })
              }
            />
            <Field
              label={t('mood.note')}
              value={current.note}
              onChangeText={(note) => setDraft({ ...current, note })}
              placeholder={t('mood.notePlaceholder')}
              multiline
              maxLength={MOOD_NOTE_MAX}
            />
            <Button title={t('mood.save')} onPress={() => void save(current)} loading={busy} />
          </View>
        ) : (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            style={styles.more}
          >
            <Text style={styles.moreText}>
              {entry && (entry.tags.length > 0 || entry.note)
                ? t('mood.seeDetails')
                : t('mood.addDetails')}
            </Text>
          </Pressable>
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
  faces: { flexDirection: 'row', justifyContent: 'space-between' },
  face: {
    width: MIN_TOUCH + 8,
    height: MIN_TOUCH + 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  faceSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceRaised },
  pressed: { opacity: 0.7 },
  center: { textAlign: 'center' },
  details: { gap: spacing.sm },
  more: { minHeight: MIN_TOUCH - 8, justifyContent: 'center' },
  moreText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
