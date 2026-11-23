import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
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

export function Screen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView {...keyboardAware} contentContainerStyle={styles.content}>
        <Text style={typography.title} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
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
