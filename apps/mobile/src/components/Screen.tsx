import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme/tokens';

/**
 * Rolagem que convive com o teclado: no iOS ganha espaço embaixo para o teclado
 * (dá para rolar até o último campo); arrastar para baixo fecha o teclado.
 * No Android o sistema já redimensiona a janela.
 */
const keyboardAware: ScrollViewProps = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: 'interactive',
};

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
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY?.set(e.contentOffset.y);
  });
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* View própria: o overlay absoluto começa abaixo da área segura, não sob a barra de status. */}
      <View style={styles.flex}>
        <Animated.ScrollView
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
        </Animated.ScrollView>
        {overlay}
      </View>
    </SafeAreaView>
  );
}

/** Tela empilhada (com cabeçalho do Stack): só rolagem e teclado, sem título próprio. */
export function StackScreen({ children }: { children?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView {...keyboardAware} contentContainerStyle={styles.content}>
        {children}
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
