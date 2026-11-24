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
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface TourSlide {
  icon: IconName | 'hero' | 'oracle';
  color: string;
  title: string;
  text: string;
  /** Mostra "Ver agora", que fecha o tour e abre esta tela. */
  route?: string;
}

const SLIDES: TourSlide[] = [
  {
    icon: 'hero',
    color: colors.primary,
    title: 'Sua jornada começa aqui',
    text: 'Cada hábito vira uma missão diária. Concluir missões dá XP, sobe o nível e faz o seu herói evoluir.',
  },
  {
    icon: 'checkmark-circle',
    color: colors.accent,
    title: 'Missões do dia',
    text: 'Na tela Hoje, toque numa missão para concluí-la. Esqueceu de marcar ontem? Use o seletor Ontem | Hoje — dá para registrar até o fim do dia.',
  },
  {
    icon: 'flash',
    color: '#FFB020',
    title: 'Missão relâmpago',
    text: 'Todo dia uma missão ganha um prazo de 4 horas. Concluída a tempo, rende +50% de XP e Cristais extras.',
  },
  {
    icon: 'star',
    color: colors.xp,
    title: 'Promoções do herói',
    text: 'Seu caminho cuida de uma área da vida. Com nível e missões nessa área, você é promovido: de Aventureiro a Cavaleiro, de Aprendiz a Arquimago…',
  },
  {
    icon: 'stats-chart',
    color: colors.primary,
    title: 'Seu progresso',
    text: 'Em Progresso você acompanha nível, streak, XP de cada dia e os atributos do herói em cada área da vida.',
  },
  {
    icon: 'oracle',
    color: '#5CF2E0',
    title: 'Conheça o Oráculo',
    text: 'O Oráculo é a inteligência artificial do app. Conte um objetivo e ele monta um plano de missões sob medida, revisa a sua semana e sugere ajustes. Ele só propõe: nada muda sem a sua aprovação. Consulte em Progresso ou ao criar um hábito.',
  },
  {
    icon: 'chatbubble-ellipses',
    color: colors.accent,
    title: 'Sua opinião importa',
    text: 'Encontrou um problema ou teve uma ideia? Envie em Perfil → Enviar feedback. Este tour também fica lá, se quiser rever.',
  },
];

/**
 * Tour rápido das funcionalidades, mostrado no primeiro acesso (e revisto pelo Perfil).
 * Pode ser pulado a qualquer momento; `onClose` é chamado ao pular ou ao terminar.
 */
export function AppTour({
  visible,
  hero,
  onClose,
  slides = SLIDES,
  heading,
  finishLabel = 'Começar',
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
              {index + 1} de {slides.length}
            </Text>
            {!last && (
              <Pressable
                onPress={close}
                accessibilityRole="button"
                hitSlop={12}
                style={styles.skip}
              >
                <Text style={styles.skipText}>Pular</Text>
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
          </Animated.View>

          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`Passo ${index + 1} de ${slides.length}`}
          >
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.actions}>
            <Button title={last ? finishLabel : 'Próximo'} onPress={next} />
            {slide.route && (
              <Button
                title="Ver agora"
                variant="secondary"
                onPress={() => {
                  const route = slide.route!;
                  close();
                  router.push(route as Href);
                }}
              />
            )}
            {index > 0 && (
              <Button title="Voltar" variant="secondary" onPress={() => setIndex((i) => i - 1)} />
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised },
  dotActive: { width: 22, backgroundColor: colors.primary },
  actions: { gap: spacing.sm },
});
