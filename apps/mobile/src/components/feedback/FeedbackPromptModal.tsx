import { isLowRating, validateFeedbackRating, FEEDBACK_RATING_MESSAGE_MAX } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, LinearTransition, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, FormMessage } from '@/components/Form';
import { Oracle } from '@/components/oracle/Oracle';
import { submitFeedbackRating } from '@/features/feedback/prompt';
import { useT, type TKey } from '@/i18n';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const RATING_LABEL: Record<number, TKey> = {
  1: 'feedbackPrompt.r1',
  2: 'feedbackPrompt.r2',
  3: 'feedbackPrompt.r3',
  4: 'feedbackPrompt.r4',
  5: 'feedbackPrompt.r5',
};

const SLIDE = SlideInDown.duration(280).easing(Easing.out(Easing.cubic));
const GROW = LinearTransition.duration(180);

/**
 * Painel de baixo do pedido de feedback: nota de 1 a 5 em gemas e comentário (com nota baixa, pergunta o
 * que melhorar). `onAnswer` diz o que a pessoa escolheu, para guardar na memória do aparelho.
 */
export function FeedbackPromptModal({
  onAnswer,
}: {
  onAnswer: (answer: 'sent' | 'later' | 'never') => void;
}) {
  const { t, locale } = useT();
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const low = rating > 0 && isLowRating(rating);
  const insets = useSafeAreaInsets();

  async function send() {
    const invalid = validateFeedbackRating(rating, message, locale);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const err = await submitFeedbackRating(rating, message);
    setBusy(false);
    if (err) return setError(err);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => onAnswer('later')}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Fundo: esmaece; tocar fora conta como "Agora não". */}
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable
            style={styles.backdrop}
            onPress={() => onAnswer(sent ? 'sent' : 'later')}
            accessibilityRole="button"
            accessibilityLabel={sent ? t('feedbackPrompt.close') : t('feedbackPrompt.later')}
          />
        </Animated.View>

        <Animated.View
          entering={SLIDE}
          layout={GROW}
          style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Oracle size={56} glow={false} />
            <Text style={styles.kicker}>{t('feedbackPrompt.kicker')}</Text>
          </View>
          {sent ? (
            <Animated.View entering={FadeIn} style={styles.center}>
              <Text style={[typography.heading, styles.text]} accessibilityRole="header">
                {t('feedbackPrompt.thanks')}
              </Text>
              <Text style={[typography.body, styles.text]}>{t('feedbackPrompt.thanksText')}</Text>
              <Button title={t('feedbackPrompt.close')} onPress={() => onAnswer('sent')} />
            </Animated.View>
          ) : (
            <>
              <Text style={[typography.heading, styles.text]} accessibilityRole="header">
                {t('feedbackPrompt.question')}
              </Text>

              <View style={styles.gems} accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = n <= rating;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setRating(n);
                        setError(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: rating === n }}
                      accessibilityLabel={`${n}: ${t(RATING_LABEL[n]!)}`}
                      hitSlop={6}
                      style={styles.gemTouch}
                    >
                      <View style={[styles.gem, on && styles.gemOn]} />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[typography.caption, styles.text]}>
                {rating > 0 ? t(RATING_LABEL[rating]!) : t('feedbackPrompt.tap')}
              </Text>

              {rating > 0 && (
                <Animated.View entering={FadeIn} style={styles.full}>
                  <Text style={typography.label}>
                    {low ? t('feedbackPrompt.whatImprove') : t('feedbackPrompt.tellMore')}
                  </Text>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder={low ? t('feedbackPrompt.improvePlaceholder') : t('feedbackPrompt.optional')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    maxLength={FEEDBACK_RATING_MESSAGE_MAX}
                    style={styles.input}
                    accessibilityLabel={low ? t('feedbackPrompt.whatImprove') : t('feedbackPrompt.tellMore')}
                  />
                </Animated.View>
              )}

              <FormMessage text={error} />
              <View style={styles.full}>
                <Button
                  title={t('feedbackPrompt.send')}
                  onPress={send}
                  loading={busy}
                  disabled={rating === 0}
                />
                <Button title={t('feedbackPrompt.later')} onPress={() => onAnswer('later')} variant="secondary" />
              </View>
              <Pressable
                onPress={() => onAnswer('never')}
                accessibilityRole="button"
                style={styles.never}
                hitSlop={8}
              >
                <Text style={typography.caption}>{t('feedbackPrompt.never')}</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,8,14,0.72)' },
  sheet: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: `${colors.xp}88`,
    backgroundColor: colors.surface,
    shadowColor: colors.xp,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  center: { alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6, color: colors.xp },
  text: { textAlign: 'center' },
  gems: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  gemTouch: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  gem: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.xp,
    transform: [{ rotate: '45deg' }],
  },
  gemOn: { backgroundColor: colors.xp, shadowColor: colors.xp, shadowOpacity: 0.8, shadowRadius: 8 },
  full: { alignSelf: 'stretch', gap: spacing.sm },
  input: {
    minHeight: 80,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  never: { minHeight: MIN_TOUCH, justifyContent: 'center' },
});
