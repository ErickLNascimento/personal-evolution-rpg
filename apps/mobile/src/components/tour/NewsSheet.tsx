import { Ionicons } from '@expo/vector-icons';
import {
  releaseItemSummary,
  releaseItemText,
  splitReleaseItems,
  type ReleaseNoteItem,
} from '@per/domain';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Form';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

const COLORS = [colors.primary, colors.accent, colors.xp, '#5CF2E0', '#FB923C'];

/**
 * Novidades numa tela só: cada recurso novo numa linha (ícone, título e um resumo curto; tocar
 * abre a tela dele) e as correções numa lista no fim.
 */
export function NewsSheet({
  visible,
  items,
  onClose,
}: {
  visible: boolean;
  items: readonly ReleaseNoteItem[];
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const { features, fixes } = splitReleaseItems(items);

  function open(route: string) {
    onClose();
    router.push(route as Href);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.sheet}>
            <Text style={styles.kicker}>{t('today.news')}</Text>
            <Text style={typography.title} accessibilityRole="header">
              {t('news.title')}
            </Text>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {features.map((item, i) => {
                const { title } = releaseItemText(item, locale);
                const color = COLORS[i % COLORS.length]!;
                const row = (
                  <>
                    <View style={[styles.icon, { borderColor: color }]}>
                      <Ionicons name={item.icon as IconName} size={20} color={color} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>{title}</Text>
                      <Text style={typography.caption} numberOfLines={2}>
                        {releaseItemSummary(item, locale)}
                      </Text>
                    </View>
                    {item.route && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                  </>
                );
                return (
                  <Animated.View key={`${item.title}-${i}`} entering={FadeInDown.delay(80 + i * 60).duration(300)}>
                    {item.route ? (
                      <Pressable
                        onPress={() => open(item.route!)}
                        accessibilityRole="button"
                        accessibilityHint={t('news.openHint')}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      >
                        {row}
                      </Pressable>
                    ) : (
                      <View style={styles.row}>{row}</View>
                    )}
                  </Animated.View>
                );
              })}
              {fixes.length > 0 && (
                <View style={styles.fixes}>
                  <Text style={styles.fixesTitle}>{t('tour.fixes')}</Text>
                  {fixes.map((item, i) => (
                    <View key={`${item.title}-${i}`} style={styles.fixRow}>
                      <Text style={typography.caption}>•</Text>
                      <Text style={[typography.caption, styles.flex]}>{releaseItemText(item, locale).text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            <Button title={t('today.gotIt')} onPress={onClose} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 11, 15, 0.85)', justifyContent: 'center' },
  safe: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: {
    maxHeight: '100%',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: colors.xp },
  list: { flexGrow: 0 },
  listContent: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.8 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  fixes: { gap: spacing.xs, marginTop: spacing.xs },
  fixesTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.textSecondary },
  fixRow: { flexDirection: 'row', gap: spacing.sm },
});
