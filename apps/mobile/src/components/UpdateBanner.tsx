import { Ionicons } from '@expo/vector-icons';
import { shouldRecheckUpdate, updateBanner } from '@per/domain';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

/**
 * Aviso de versão nova (EAS Update). Ao abrir, o app procura e baixa a versão nova sozinho
 * (checkAutomatically ON_LOAD); ela entra na próxima abertura. Este aviso só conta isso ao
 * usuário e, ao voltar para o app depois de um tempo, confere de novo.
 * Não aparece em desenvolvimento nem no Expo Go (lá o expo-updates fica desligado).
 */
export function UpdateBanner() {
  if (__DEV__ || !Updates.isEnabled) return null;
  return <UpdateBannerInner />;
}

function UpdateBannerInner() {
  const updates = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const lastCheck = useRef<Date | null>(null);

  // Ao voltar para o primeiro plano: confere e, se houver, baixa em segundo plano.
  useEffect(() => {
    lastCheck.current = new Date(); // a conferência da abertura é automática
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !shouldRecheckUpdate(lastCheck.current, new Date())) return;
      lastCheck.current = new Date();
      void (async () => {
        try {
          const r = await Updates.checkForUpdateAsync();
          if (r.isAvailable) await Updates.fetchUpdateAsync();
        } catch {
          // Sem internet ou servidor fora: tenta de novo na próxima volta ao app.
        }
      })();
    });
    return () => sub.remove();
  }, []);

  const updateId = updates.downloadedUpdate?.updateId ?? updates.availableUpdate?.updateId ?? null;
  const banner = updateBanner(
    {
      isUpdateAvailable: updates.isUpdateAvailable,
      isUpdatePending: updates.isUpdatePending,
      isDownloading: updates.isDownloading,
      downloadProgress: updates.downloadProgress,
      updateId,
    },
    dismissed,
  );
  if (!banner) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.wrap, { top: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      <View style={styles.card} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Ionicons
          name={banner.kind === 'ready' ? 'checkmark-circle' : 'cloud-download-outline'}
          size={22}
          color={banner.kind === 'ready' ? colors.accent : colors.primary}
        />
        <View style={styles.body}>
          <Text style={styles.title}>{banner.title}</Text>
          <Text style={typography.caption}>{banner.text}</Text>
          {banner.kind === 'ready' && (
            <Pressable
              onPress={() => {
                setApplying(true);
                void Updates.reloadAsync().catch(() => setApplying(false));
              }}
              disabled={applying}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.action}>{applying ? 'Aplicando…' : 'Aplicar agora'}</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setDismissed(updateId ?? 'sem-id')}
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          hitSlop={10}
          style={styles.close}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  action: { marginTop: spacing.xs, fontSize: 14, fontWeight: '700', color: colors.primary },
  close: { minWidth: MIN_TOUCH / 2, alignItems: 'center' },
});
