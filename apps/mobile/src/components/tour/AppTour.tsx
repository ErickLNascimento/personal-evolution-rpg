import { Ionicons } from '@expo/vector-icons';
import type { HeroLook } from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useState, type ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Button } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { Oracle } from '@/components/oracle/Oracle';
import { useT, type TKey } from '@/i18n';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface TourSlide {
  icon: IconName | 'hero' | 'oracle';
  color: string;
  title: string;
  text: string;
  /** Mostra "Ver agora", que fecha o tour e abre esta tela. */
  route?: string;
  /** Lista curta de correções (Novidades: só no último slide). */
  notes?: readonly string[];
}

/** Tour padrão: textos vêm do dicionário (tour.s1Title, tour.s1Text, …). */
const SLIDE_ART: { icon: TourSlide['icon']; color: string }[] = [
  { icon: 'hero', color: colors.primary },
  { icon: 'checkmark-circle', color: colors.accent },
  { icon: 'flash', color: '#FFB020' },
  { icon: 'star', color: colors.xp },
  { icon: 'stats-chart', color: colors.primary },
  { icon: 'oracle', color: '#5CF2E0' },
  { icon: 'chatbubble-ellipses', color: colors.accent },
];

const SLIDE_KEYS: [TKey, TKey][] = [
  ['tour.s1Title', 'tour.s1Text'],
  ['tour.s2Title', 'tour.s2Text'],
  ['tour.s3Title', 'tour.s3Text'],
  ['tour.s4Title', 'tour.s4Text'],
  ['tour.s5Title', 'tour.s5Text'],
  ['tour.s6Title', 'tour.s6Text'],
  ['tour.s7Title', 'tour.s7Text'],
];

/**
 * Tour rápido das funcionalidades, mostrado no primeiro acesso (e revisto pelo Perfil).
 * Pode ser pulado a qualquer momento; `onClose` é chamado ao pular ou ao terminar.
 */
export function AppTour({
  visible,
  hero,
  onClose,
  slides: customSlides,
  heading,
  finishLabel,
}: {
  visible: boolean;
  hero: HeroLook;
  onClose: () => void;
  /** Padrão: o tour completo do app. */
  slides?: readonly TourSlide[];
  /** Rótulo no topo (ex.: "NOVIDADES"). */
  heading?: string;
  finishLabel?: string;
}) {
  const { t } = useT();
  const slides: readonly TourSlide[] =
    customSlides ??
    SLIDE_ART.map((art, i) => ({ ...art, title: t(SLIDE_KEYS[i]![0]), text: t(SLIDE_KEYS[i]![1]) }));
  const [index, setIndex] = useState(0);
  // Sem slides (ex.: nenhuma novidade pendente) não há o que mostrar.
  const slide = slides[Math.min(index, slides.length - 1)];
  const last = index >= slides.length - 1;

  function close() {
    setIndex(0);
    onClose();
  }

  function next() {
    void Haptics.selectionAsync();
    if (last) close();
    else setIndex((i) => i + 1);
  }

  if (!slide) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.top}>
            <Text style={typography.caption}>
              {heading ? `${heading} · ` : ''}
              {t('tour.position', { n: index + 1, total: slides.length })}
            </Text>
            {!last && (
              <Pressable
                onPress={close}
                accessibilityRole="button"
                hitSlop={12}
                style={styles.skip}
              >
                <Text style={styles.skipText}>{t('tour.skip')}</Text>
              </Pressable>
            )}
          </View>

          <Animated.View key={index} entering={FadeInRight.duration(260)} style={styles.card}>
            <View style={[styles.art, { borderColor: slide.color }]}>
              {slide.icon === 'hero' ? (
                <HeroAvatar hero={hero} size={110} animated />
              ) : slide.icon === 'oracle' ? (
                <Oracle size={150} />
              ) : (
                <Ionicons name={slide.icon} size={64} color={slide.color} />
              )}
            </View>
            <Text style={[typography.title, styles.center]} accessibilityRole="header">
              {slide.title}
            </Text>
            <Text style={[typography.body, styles.center]}>{slide.text}</Text>
            {slide.notes && slide.notes.length > 0 && (
              <View style={styles.notes} accessible accessibilityLabel={`${t('tour.fixes')}: ${slide.notes.join('. ')}`}>
                <Text style={styles.notesTitle}>{t('tour.fixes')}</Text>
                {slide.notes.map((note, i) => (
                  <View key={i} style={styles.noteRow}>
                    <Text style={typography.caption}>•</Text>
                    <Text style={[typography.caption, styles.noteText]}>{note}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          <View
            style={styles.dots}
            accessible
            accessibilityLabel={t('onboarding.step', { step: index + 1, total: slides.length })}
          >
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.actions}>
            <Button title={last ? (finishLabel ?? t('tour.start')) : t('tour.next')} onPress={next} />
            {slide.route && (
              <Button
                title={t('tour.seeNow')}
                variant="secondary"
                onPress={() => {
                  const route = slide.route!;
                  close();
                  router.push(route as Href);
                }}
              />
            )}
            {index > 0 && (
              <Button title={t('screens.back')} variant="secondary" onPress={() => setIndex((i) => i - 1)} />
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 11, 15, 0.96)' },
  safe: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: MIN_TOUCH,
  },
  skip: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: spacing.sm },
  skipText: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  art: {
    width: 150,
    height: 150,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  center: { textAlign: 'center' },
  notes: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  notesTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.textSecondary },
  noteRow: { flexDirection: 'row', gap: spacing.sm },
  noteText: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised },
  dotActive: { width: 22, backgroundColor: colors.primary },
  actions: { gap: spacing.sm },
});
