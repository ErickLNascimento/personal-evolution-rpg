import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';

/**
 * Rolagem que convive com o teclado: no iOS ganha espaço embaixo para o teclado
 * (dá para rolar até o último campo); arrastar para baixo fecha o teclado.
 * No Android (edge-to-edge, a janela não encolhe) o espaço vem de useAndroidKeyboard.
 */
const keyboardAware: ScrollViewProps = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'interactive',
};

/** Folga entre o campo focado e o topo do teclado. */
const KEYBOARD_GAP = 24;

/**
 * Android: altura do teclado aberto (para um espaço no fim da rolagem) e, ao abrir, rola até o
 * campo focado ficar acima dele. No iOS devolve 0 (automaticallyAdjustKeyboardInsets resolve).
 */
function useAndroidKeyboard(
  ref: RefObject<ScrollViewInstance | null>,
  offset: { get: () => number },
): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const kb = e.endCoordinates.height;
      setHeight(kb);
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = ref.current;
      if (!input || !scroll) return;
      const keyboardTop = e.endCoordinates.screenY || Dimensions.get('screen').height - kb;
      // Espera o espaço extra entrar no layout antes de rolar.
      requestAnimationFrame(() => {
        // measureLayout só dá certo se o campo estiver dentro desta rolagem (as abas ficam
        // todas montadas; só a que tem o campo rola).
        input.measureLayout(
          scroll as unknown as Parameters<typeof input.measureLayout>[0],
          () => {
            input.measureInWindow((_x, y, _w, h) => {
              const overflow = y + h - (keyboardTop - KEYBOARD_GAP);
              if (overflow > 0) scroll.scrollTo({ y: offset.get() + overflow, animated: true });
            });
          },
          () => {},
        );
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref, offset]);
  return height;
}

export function Screen({
  title,
  children,
  onRefresh,
  refreshing = false,
  scrollY,
  overlay,
}: {
  title: string;
  children?: ReactNode;
  /** Com isto, puxar a tela para baixo recarrega os dados. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Recebe a posição da rolagem (na thread de UI), para cabeçalhos que reagem a ela. */
  scrollY?: SharedValue<number>;
  /** Fica fixo no topo, por cima da rolagem (ex.: barra compacta do herói). */
  overlay?: ReactNode;
}) {
  const ref = useRef<ScrollViewInstance>(null);
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    offset.set(e.contentOffset.y);
    scrollY?.set(e.contentOffset.y);
  });
  const keyboard = useAndroidKeyboard(ref, offset);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* View própria: o overlay absoluto começa abaixo da área segura, não sob a barra de status. */}
      <View style={styles.flex}>
        <Animated.ScrollView
          ref={ref}
          {...keyboardAware}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          <Text style={typography.title} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.body}>{children}</View>
          {keyboard > 0 && <View style={{ height: keyboard }} />}
        </Animated.ScrollView>
        {overlay}
      </View>
    </SafeAreaView>
  );
}

/** Tela empilhada (com cabeçalho do Stack): só rolagem e teclado, sem título próprio. */
export function StackScreen({ children }: { children?: ReactNode }) {
  const ref = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const [getter] = useState(() => ({ get: () => offset.current }));
  const keyboard = useAndroidKeyboard(ref, getter);
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        ref={ref}
        {...keyboardAware}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        {children}
        {keyboard > 0 && <View style={{ height: keyboard }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Placeholder({ text }: { text: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={typography.caption}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  body: { gap: spacing.md },
  placeholder: {
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
});
