import { Ionicons } from '@expo/vector-icons';
import {
  HERO_SLOTS,
  isUnlocked,
  itemLabel,
  slotLabel,
  type HeroItem,
  type HeroLook,
  type HeroSlot,
} from '@per/domain';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { useT } from '@/i18n';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

/** Ouro velho dos detalhes do vestiário. */
export const GOLD = '#D9A441';
const STONE = '#2A2733';
const STONE_DARK = '#1C1A23';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Chama de tocha: tremula sem parar, cada uma no seu ritmo. */
function Torch({ delay }: { delay: number }) {
  const flicker = useSharedValue(0);
  useEffect(() => {
    flicker.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 380 + delay, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 260 + delay / 2, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [flicker, delay]);
  const flame = useAnimatedStyle(() => ({
    opacity: 0.65 + flicker.value * 0.35,
    transform: [{ scaleY: 0.85 + flicker.value * 0.25 }, { scaleX: 1.05 - flicker.value * 0.1 }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.12 + flicker.value * 0.18 }));
  return (
    <View style={styles.torch} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.torchGlow, glow]} />
      <Animated.View style={flame}>
        <Ionicons name="flame" size={26} color="#FB923C" />
      </Animated.View>
      <View style={styles.torchStick} />
    </View>
  );
}

/**
 * Palco do vestiário: o herói grande sobre um pedestal de pedra, entre duas tochas, com o título
 * num estandarte. `cheer` sobe a cada escolha e faz o herói comemorar.
 */
export function WardrobeStage({
  hero,
  cheer,
  frame,
  title,
  titleColor,
  subtitle,
  caption,
  notice,
}: {
  notice?: ReactNode;
  hero: HeroLook;
  cheer: number;
  frame: string;
  title: string;
  titleColor: string;
  subtitle: string;
  caption: string;
}) {
  return (
    <View style={[styles.stage, { borderColor: `${frame}AA` }]}>
      <View style={styles.arch} />
      <View style={[styles.banner, { borderColor: titleColor }]}>
        <Text style={[styles.bannerText, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.stageRow}>
        <Torch delay={0} />
        <View style={styles.heroBox}>
          <HeroAvatar hero={hero} size={132} animated cheer={cheer} />
          <View style={styles.pedestalTop} />
          <View style={styles.pedestalBase} />
        </View>
        <Torch delay={90} />
      </View>
      <Text style={[typography.heading, styles.center]}>{subtitle}</Text>
      <Text style={[typography.caption, styles.center]}>{caption}</Text>
      {notice}
    </View>
  );
}

/** Aviso no pedestal durante a prévia de uma peça bloqueada. */
export function PreviewNotice({
  text,
  action,
  onAction,
  onClose,
}: {
  text: string;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Ionicons name="eye" size={14} color={GOLD} />
      <Text style={styles.noticeText} numberOfLines={2}>
        {text}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} style={styles.noticeAction}>
          <Text style={styles.noticeActionText}>{action}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('heroScreen.previewClose')}
        hitSlop={10}
      >
        <Ionicons name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export interface WardrobeTab {
  key: string;
  icon: IconName;
  label: string;
}

/**
 * Abas do grimório. O marcador dourado segue `progress` (posição da rolagem em páginas), então
 * acompanha o dedo enquanto a pessoa desliza entre as abas.
 */
export function WardrobeTabs({
  tabs,
  index,
  progress,
  width,
  onSelect,
}: {
  tabs: readonly WardrobeTab[];
  index: number;
  progress: SharedValue<number>;
  width: number;
  onSelect: (i: number) => void;
}) {
  const tabWidth = width / tabs.length;
  const marker = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, tabs.length - 1],
          [0, tabWidth * (tabs.length - 1)],
        ),
      },
    ],
  }));
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((tab, i) => {
        const active = i === index;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={[styles.tab, { width: tabWidth }]}
          >
            <Ionicons name={tab.icon} size={20} color={active ? GOLD : colors.textSecondary} />
            <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.marker, { width: tabWidth }, marker]}>
        <View style={styles.markerBar} />
      </Animated.View>
    </View>
  );
}

/** Título de seção com ornamento: ── ◆ CABELO ◆ ── */
export function Ornament({ children }: { children: ReactNode }) {
  return (
    <View style={styles.ornament} accessibilityRole="header">
      <View style={styles.ornamentLine} />
      <Text style={styles.ornamentText}>◆ {children} ◆</Text>
      <View style={styles.ornamentLine} />
    </View>
  );
}

/** Peças que ganham miniatura do herói (as de cor viram gemas). */
const PREVIEW_SLOTS: ReadonlySet<HeroSlot> = new Set(['hair', 'aura', 'accessory']);

/**
 * Inventário de uma peça: cada espaço mostra o herói usando a peça (ou uma gema da cor). Bloqueadas
 * mostram o nível; as da Loja, o preço (tocar abre a Loja).
 */
export function InventoryPicker({
  slot,
  look,
  value,
  level,
  owned,
  previewing,
  onChoose,
  onPreview,
}: {
  slot: HeroSlot;
  look: HeroLook;
  value: string;
  level: number;
  owned: ReadonlySet<string>;
  /** Peça bloqueada sendo vista no pedestal. */
  previewing: string | null;
  onChoose: (id: string) => void;
  /** Tocar numa peça bloqueada: mostra no herói, sem equipar. */
  onPreview: (item: HeroItem) => void;
}) {
  const { t, locale } = useT();
  const { items } = HERO_SLOTS[slot];
  const preview = PREVIEW_SLOTS.has(slot);
  const current = items.find((i) => i.id === value);
  return (
    <View style={styles.section}>
      <Ornament>{slotLabel(slot, locale).toUpperCase()}</Ornament>
      <View style={styles.grid}>
        {items.map((item: HeroItem) => {
          const unlocked = isUnlocked(item, level, owned);
          const fromShop = item.price !== undefined;
          const active = item.id === value;
          const name = itemLabel(slot, item, locale);
          const a11y = unlocked
            ? name
            : fromShop
              ? t('heroScreen.itemInShop', { name, price: item.price ?? 0 })
              : t('heroScreen.itemLocked', { name, level: item.level });
          return (
            <Pressable
              key={item.id}
              onPress={() => (unlocked ? onChoose(item.id) : onPreview(item))}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !unlocked }}
              accessibilityLabel={a11y}
              style={({ pressed }) => [
                preview ? styles.cell : styles.gemCell,
                active && styles.cellActive,
                previewing === item.id && styles.cellPreview,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.cellInner, !unlocked && styles.locked]}>
                {preview ? (
                  <HeroAvatar hero={{ ...look, [slot]: item.id }} size={46} />
                ) : (
                  <View style={[styles.gem, { backgroundColor: item.color ?? colors.surfaceRaised }]}>
                    <View style={styles.gemShine} />
                  </View>
                )}
              </View>
              {!unlocked && (
                <View style={styles.lockBadge}>
                  <Ionicons
                    name={fromShop ? 'diamond' : 'lock-closed'}
                    size={10}
                    color={fromShop ? '#5CF2E0' : colors.text}
                  />
                  <Text style={styles.lockText}>{fromShop ? item.price : item.level}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {current && <Text style={styles.itemName}>{itemLabel(slot, current, locale)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: STONE_DARK,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 2,
  },
  // Arco de pedra atrás do herói.
  arch: {
    position: 'absolute',
    top: 30,
    width: 190,
    height: 260,
    borderTopLeftRadius: 95,
    borderTopRightRadius: 95,
    backgroundColor: STONE,
    borderWidth: 1,
    borderColor: '#3A3645',
  },
  banner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    backgroundColor: '#3B1E2A',
    maxWidth: '80%',
  },
  bannerText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textAlign: 'center' },
  stageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  heroBox: { alignItems: 'center' },
  pedestalTop: {
    width: 120,
    height: 10,
    marginTop: -6,
    borderRadius: 3,
    backgroundColor: '#4A4556',
    borderWidth: 1,
    borderColor: '#5C5669',
  },
  pedestalBase: {
    width: 96,
    height: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#35313F',
  },
  torch: { alignItems: 'center', marginBottom: 40, width: 30 },
  torchGlow: {
    position: 'absolute',
    top: -14,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FB923C',
  },
  torchStick: { width: 5, height: 26, borderRadius: 2, backgroundColor: '#6B4A2B', marginTop: -4 },
  center: { textAlign: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: GOLD,
    backgroundColor: '#2B2417',
  },
  noticeText: { ...typography.caption, flex: 1, color: colors.text },
  noticeAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: GOLD,
  },
  noticeActionText: { fontSize: 12, fontWeight: '800', color: '#1C1A23' },
  tabs: {
    flexDirection: 'row',
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    minHeight: MIN_TOUCH + 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: GOLD },
  marker: { position: 'absolute', bottom: -1, left: 0, alignItems: 'center' },
  markerBar: { width: '60%', height: 3, borderRadius: 2, backgroundColor: GOLD },
  section: { gap: spacing.sm },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ornamentLine: { flex: 1, height: 1, backgroundColor: `${GOLD}55` },
  ornamentText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: GOLD },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  cell: {
    width: 64,
    height: 72,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: '#3A3645',
    backgroundColor: STONE,
  },
  gemCell: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: '#3A3645',
    backgroundColor: STONE,
  },
  cellInner: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellActive: { borderColor: GOLD, backgroundColor: '#3A2F1E' },
  cellPreview: { borderColor: GOLD, borderStyle: 'dashed' },
  gem: {
    width: 30,
    height: 30,
    borderRadius: 8,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  gemShine: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  locked: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  lockBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockText: { fontSize: 10, fontWeight: '800', color: colors.text },
  itemName: { ...typography.caption, textAlign: 'center', color: colors.text },
});
