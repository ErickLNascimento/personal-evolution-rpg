import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  validateFeedback,
  type FeedbackKind,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Field, FormMessage } from '@/components/Form';
import { StackScreen } from '@/components/Screen';
import { sendFeedback } from '@/features/feedback/api';
import { typography } from '@/theme/tokens';
import { useT } from '@/i18n';

const KIND_KEY = {
  bug: 'feedback.kindBug',
  ideia: 'feedback.kindIdea',
  elogio: 'feedback.kindPraise',
  outro: 'feedback.kindOther',
} as const satisfies Record<FeedbackKind, string>;

const PLACEHOLDER_KEY = {
  bug: 'feedback.placeholderBug',
  ideia: 'feedback.placeholderIdea',
  elogio: 'feedback.placeholderPraise',
  outro: 'feedback.placeholderOther',
} as const satisfies Record<FeedbackKind, string>;

/** Feedback dos testadores: tipo + texto livre. A equipe lê pelo painel do Supabase. */
export default function FeedbackScreen() {
  const { t, locale } = useT();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const invalid = validateFeedback(message, locale);
    if (invalid) return setError(invalid);
    setError(null);
    setSending(true);
    const err = await sendFeedback(kind, message);
    setSending(false);
    if (err) return setError(err);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  }

  if (sent) {
    return (
      <StackScreen>
        <Text style={typography.heading}>{t('feedback.thanks')}</Text>
        <Text style={typography.body}>{t('feedback.received')}</Text>
        <Button title={t('feedback.back')} onPress={() => router.back()} />
        <Button
          title={t('feedback.another')}
          variant="secondary"
          onPress={() => {
            setMessage('');
            setSent(false);
          }}
        />
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <Text style={typography.body}>{t('feedback.intro')}</Text>
      <Chips
        options={FEEDBACK_KINDS.map((k) => ({ value: k, label: t(KIND_KEY[k]) }))}
        selected={[kind]}
        onToggle={setKind}
      />
      <Field
        label={t('feedback.message')}
        value={message}
        onChangeText={setMessage}
        placeholder={t(PLACEHOLDER_KEY[kind])}
        multiline
        maxLength={FEEDBACK_MAX}
        textAlignVertical="top"
        style={styles.message}
      />
      <Text style={typography.caption}>
        {t('feedback.counter', { count: message.trim().length, max: FEEDBACK_MAX })}
      </Text>
      <FormMessage text={error} />
      <Button title={t('feedback.send')} onPress={submit} loading={sending} />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  message: { minHeight: 140 },
});
