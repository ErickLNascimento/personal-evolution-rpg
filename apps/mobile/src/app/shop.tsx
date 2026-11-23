import { Ionicons } from '@expo/vector-icons';
import {
  CLASS_CATALOG,
  CLASS_TIER_LABEL,
  HERO_ATTRIBUTES,
  HERO_CLASS_INFO,
  HERO_CLASSES,
  heroClassLabel,
  OBJECTIVE_CATEGORY_LABEL,
  purchaseStatus,
  type HeroClass,
  type PurchaseStatus,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CRYSTAL, CrystalBadge } from '@/components/crystals/Crystals';
import { FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { StackScreen } from '@/components/Screen';
import { useHero } from '@/features/hero/useHero';
import { useProfile } from '@/features/profile/ProfileProvider';
import { buyClass, fetchCrystals } from '@/features/shop/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const TIER_COLOR: Record<number, string> = {
  1: colors.textSecondary,
  2: '#16C79A',
  3: '#3D7BFF',
  4: '#8B5CF6',
  5: '#F5B942',
};

export default function ShopScreen() {
  const { hero, level, save } = useHero();
  const { profile, refresh } = useProfile();
  const load = useCallback(() => fetchCrystals(), []);
  const crystalsLoad = useFocusLoad<number>(load);
  const [busy, setBusy] = useState<HeroClass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!profile || crystalsLoad.data === null) {
    return (
      <StackScreen>
        {crystalsLoad.error ? (
          <FormMessage text={crystalsLoad.error} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }

  const crystals = crystalsLoad.data;
  const owned = profile.owned;

  async function equip(c: HeroClass) {
    setBusy(c);
    const err = await save({ ...hero, heroClass: c });
    setBusy(null);
    if (err) setError(err);
    else {
      void Haptics.selectionAsync();
      setNotice(`${heroClassLabel(c, hero.form)} equipado.`);
    }
  }

  async function buy(c: HeroClass) {
    setBusy(c);
    setError(null);
    setNotice(null);
    const r = await buyClass(c);
    if (r.error !== null) {
      setBusy(null);
      setError(r.error);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    crystalsLoad.setData(r.data.crystals);
    await refresh();
    setBusy(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(`${heroClassLabel(c, hero.form)} desbloqueado!`, 'Quer equipar agora?', [
      { text: 'Depois', style: 'cancel' },
      { text: 'Equipar', onPress: () => void equip(c) },
    ]);
  }

  function confirmBuy(c: HeroClass) {
    const price = CLASS_CATALOG[c].price;
    Alert.alert(
      `Comprar ${heroClassLabel(c, hero.form)}?`,
      `Custa ${price} Cristais. Você tem ${crystals}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Comprar', onPress: () => void buy(c) },
      ],
    );
  }

  return (
    <StackScreen>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={typography.heading}>Classes</Text>
          <Text style={typography.caption}>
            Nível {level.level}. Cada classe rende mais Cristais nas missões da área dela.
          </Text>
        </View>
        <CrystalBadge amount={crystals} />
      </View>

      <FormMessage text={notice} tone="info" />
      <FormMessage text={error} />

      {HERO_CLASSES.map((c) => (
        <ClassCard
          key={c}
          heroClass={c}
          status={purchaseStatus(c, level.level, crystals, owned)}
          equipped={hero.heroClass === c}
          crystals={crystals}
          preview={{ ...hero, heroClass: c }}
          busy={busy === c}
          disabled={busy !== null}
          onBuy={() => confirmBuy(c)}
          onEquip={() => void equip(c)}
        />
      ))}
    </StackScreen>
  );
}

function ClassCard({
  heroClass,
  status,
  equipped,
  crystals,
  preview,
  busy,
  disabled,
  onBuy,
  onEquip,
}: {
  heroClass: HeroClass;
  status: PurchaseStatus;
  equipped: boolean;
  crystals: number;
  preview: Parameters<typeof HeroAvatar>[0]['hero'];
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const c = CLASS_CATALOG[heroClass];
  const tierColor = TIER_COLOR[c.tier] ?? colors.textSecondary;
  const locked = status === 'needs_level';
  const area = `+${c.areaPct}% de Cristais em ${OBJECTIVE_CATEGORY_LABEL[c.area]} (${HERO_ATTRIBUTES[c.area].label})`;

  let action: {
    label: string;
    onPress?: () => void;
    style: 'primary' | 'ghost' | 'muted';
    icon?: keyof typeof Ionicons.glyphMap;
  };
  if (equipped) action = { label: 'Equipada', style: 'muted', icon: 'checkmark' };
  else if (status === 'free' || status === 'owned')
    action = { label: 'Equipar', onPress: onEquip, style: 'ghost' };
  else if (status === 'buyable')
    action = { label: `Comprar · ${c.price}`, onPress: onBuy, style: 'primary', icon: 'diamond' };
  else if (status === 'needs_crystals')
    action = { label: `Faltam ${c.price - crystals}`, style: 'muted', icon: 'diamond' };
  else action = { label: `Nível ${c.minLevel}`, style: 'muted', icon: 'lock-closed' };

  return (
    <View
      style={[
        styles.card,
        equipped && { borderColor: colors.primary },
        { borderLeftColor: tierColor },
      ]}
    >
      <View style={[styles.portrait, locked && styles.lockedPortrait]}>
        <HeroAvatar hero={{ ...preview, aura: 'nenhuma' }} size={70} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.tier, { color: tierColor }]}>
          {(CLASS_TIER_LABEL[c.tier] ?? '').toUpperCase()}
          {c.price > 0 ? ` · NÍVEL ${c.minLevel}` : ''}
        </Text>
        <Text style={typography.heading}>{heroClassLabel(heroClass, preview.form)}</Text>
        <Text style={typography.caption}>{HERO_CLASS_INFO[heroClass].motto}</Text>
        <Text style={styles.bonus}>◆ {area}</Text>
        {c.perk && <Text style={styles.bonus}>◆ {c.perk}</Text>}
        <Pressable
          onPress={action.onPress}
          disabled={!action.onPress || disabled}
          accessibilityRole="button"
          accessibilityLabel={`${heroClassLabel(heroClass, preview.form)}: ${action.label}`}
          style={({ pressed }) => [
            styles.action,
            action.style === 'primary' && styles.actionPrimary,
            action.style === 'ghost' && styles.actionGhost,
            action.style === 'muted' && styles.actionMuted,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              {action.icon && (
                <Ionicons
                  name={action.icon}
                  size={14}
                  color={
                    action.style === 'primary'
                      ? '#0B0B12'
                      : action.icon === 'diamond'
                        ? CRYSTAL
                        : colors.textSecondary
                  }
                />
              )}
              <Text
                style={[styles.actionText, action.style === 'primary' && styles.actionTextPrimary]}
              >
                {action.label}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
  },
  portrait: {
    width: 76,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  lockedPortrait: { opacity: 0.45 },
  body: { flex: 1, gap: 3 },
  tier: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  bonus: { fontSize: 13, color: colors.text },
  action: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  actionPrimary: { backgroundColor: CRYSTAL },
  actionGhost: { borderWidth: 1.5, borderColor: colors.primary },
  actionMuted: { backgroundColor: colors.surfaceRaised },
  actionText: { fontSize: 14, fontWeight: '800', color: colors.text },
  actionTextPrimary: { color: '#0B0B12' },
  pressed: { opacity: 0.8 },
});
