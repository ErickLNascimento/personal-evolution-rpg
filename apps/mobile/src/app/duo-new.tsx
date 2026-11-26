import {
  DUO_TARGETS,
  duoReward,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_CATEGORY_LABELS,
  socialName,
  type ObjectiveCategory,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import { FriendRow } from '@/components/social/FriendRow';
import { createDuoQuest } from '@/features/duo/api';
import { fetchFriends, type SocialSummary } from '@/features/social/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const ANY = 'any';

/** Convidar um amigo para uma missão em equipe da semana: com quem, em que área e a meta. */
export default function NewDuoQuestScreen() {
  const { t, locale } = useT();
  const params = useLocalSearchParams<{ friend?: string }>();
  const load = useCallback(async () => {
    const r = await fetchFriends();
    return r.error !== null ? r : { data: r.data.friends, error: null };
  }, []);
  const friends = useFocusLoad<SocialSummary[]>(load);
  const [friend, setFriend] = useState<string | null>(params.friend ?? null);
  const [area, setArea] = useState<ObjectiveCategory | typeof ANY>(ANY);
  const [target, setTarget] = useState<number>(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!friend) return setError(t('duo.pickFriendFirst'));
    setSaving(true);
    setError(null);
    const r = await createDuoQuest(friend, area === ANY ? null : area, target);
    setSaving(false);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  if (!friends.data) {
    return (
      <StackScreen>
        {friends.error ? (
          <>
            <FormMessage text={friends.error} />
            <Button title={t('common.retry')} variant="secondary" onPress={friends.refresh} />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }

  if (friends.data.length === 0) {
    return (
      <StackScreen>
        <Text style={typography.body}>{t('duo.noFriends')}</Text>
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <Text style={typography.caption}>{t('duo.hint')}</Text>

      <Text style={styles.label}>{t('duo.pickFriend')}</Text>
      <View style={styles.list} accessibilityRole="radiogroup">
        {friends.data.map((f) => (
          <View
            key={f.userId}
            style={[styles.option, friend === f.userId && styles.selected]}
            accessibilityState={{ selected: friend === f.userId }}
          >
            <FriendRow person={f} onPress={() => setFriend(f.userId)} />
          </View>
        ))}
      </View>

      <Text style={styles.label}>{t('duo.pickArea')}</Text>
      <Chips
        options={[
          { value: ANY, label: t('duo.anyArea') },
          ...OBJECTIVE_CATEGORIES.map((c) => ({
            value: c,
            label: OBJECTIVE_CATEGORY_LABELS[locale][c],
          })),
        ]}
        selected={[area]}
        onToggle={(v) => setArea(v)}
      />

      <Text style={styles.label}>{t('duo.pickTarget')}</Text>
      <Chips
        options={DUO_TARGETS.map((n) => ({
          value: n,
          label: t('duo.targetOption', { n, reward: duoReward(n) }),
        }))}
        selected={[target]}
        onToggle={(v) => setTarget(v)}
      />

      <FormMessage text={error} />
      <Button
        title={
          friend
            ? `${t('duo.send')} · ${socialName(
                friends.data.find((f) => f.userId === friend)?.displayName,
                locale,
              )}`
            : t('duo.send')
        }
        onPress={send}
        loading={saving}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.textSecondary },
  list: { gap: spacing.sm },
  option: { borderRadius: radius.md + 2, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: colors.primary },
});
