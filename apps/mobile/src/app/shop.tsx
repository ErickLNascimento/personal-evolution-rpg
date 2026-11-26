import { Ionicons } from '@expo/vector-icons';
import {
  REWARD_PRICE_MAX,
  REWARD_PRICE_MIN,
  rewardSuggestions,
  itemLabel,
  slotLabel,
  SHOP_COSMETICS,
  validateReward,
  type HeroItem,
  type HeroLook,
  type HeroSlot,
  FEATURES,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { CrystalBadge, CRYSTAL } from '@/components/crystals/Crystals';
import { Button, Field, FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { FeatureGate } from '@/components/FeatureGate';
import { StackScreen } from '@/components/Screen';
import { useHero } from '@/features/hero/useHero';
import { useProfile } from '@/features/profile/ProfileProvider';
import {
  buyCosmetic,
  deleteReward,
  fetchShop,
  redeemReward,
  saveReward,
  type CustomReward,
  type ShopData,
} from '@/features/shop/api';
import { useFocusLoad } from '@/lib/useFocusLoad';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';
import { useT } from '@/i18n';

type Tab = 'rewards' | 'cosmetics';

/** Loja: recompensas da vida real (criadas pelo usuário) e cosméticos do herói, pagos com Cristais. */
function ShopScreen() {
  const { t } = useT();
  const load = useCallback(() => fetchShop(), []);
  const shop = useFocusLoad<ShopData>(load);
  const [tab, setTab] = useState<Tab>('rewards');

  if (!shop.data) {
    return (
      <StackScreen>
        {shop.error ? (
          <FormMessage text={shop.error} />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </StackScreen>
    );
  }

  return (
    <StackScreen>
      <View style={styles.balance}>
        <Text style={typography.label}>{t('shop.balance')}</Text>
        <CrystalBadge amount={shop.data.crystals} />
      </View>
      <Chips
        options={[
          { value: 'rewards' as const, label: t('shop.rewards') },
          { value: 'cosmetics' as const, label: t('shop.cosmetics') },
        ]}
        selected={[tab]}
        onToggle={setTab}
      />
      {tab === 'rewards' ? (
        <Rewards data={shop.data} onChange={shop.refresh} />
      ) : (
        <Cosmetics crystals={shop.data.crystals} onChange={shop.refresh} />
      )}
    </StackScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// Recompensas personalizadas
// ─────────────────────────────────────────────────────────────
function Rewards({ data, onChange }: { data: ShopData; onChange: () => void }) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState<CustomReward | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function redeem(r: CustomReward) {
    Alert.alert(
      t('shop.redeemTitle', { title: r.title }),
      t('shop.redeemText', { price: r.price }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('shop.redeem'),
          onPress: async () => {
            setBusy(r.id);
            setError(null);
            const res = await redeemReward(r.id);
            setBusy(null);
            if (res.error !== null) return setError(res.error);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onChange();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.section}>
      <Text style={typography.body}>{t('shop.rewardsHint')}</Text>
      <FormMessage text={error} />

      {data.rewards.map((r) =>
        editing !== 'new' && editing?.id === r.id ? (
          <RewardForm
            key={r.id}
            initial={r}
            onDone={() => {
              setEditing(null);
              onChange();
            }}
          />
        ) : (
          <View key={r.id} style={styles.reward}>
            <Text style={styles.emoji}>{r.emoji || '🎁'}</Text>
            <View style={styles.flex}>
              <Text style={typography.body}>{r.title}</Text>
              <Text style={[typography.caption, { color: CRYSTAL }]}>
                {t('common.crystals', { amount: r.price })}
              </Text>
            </View>
            <Pressable
              onPress={() => setEditing(r)}
              accessibilityRole="button"
              accessibilityLabel={t('shop.edit', { title: r.title })}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
            </Pressable>
            <Button
              title={t('shop.redeem')}
              onPress={() => redeem(r)}
              loading={busy === r.id}
              disabled={data.crystals < r.price}
            />
          </View>
        ),
      )}

      {editing === 'new' ? (
        <RewardForm
          onDone={() => {
            setEditing(null);
            onChange();
          }}
        />
      ) : (
        <Button title={t('shop.newReward')} variant="secondary" onPress={() => setEditing('new')} />
      )}

      {data.rewards.length === 0 && editing === null && (
        <View style={styles.section}>
          <Text style={typography.label}>{t('shop.ideas')}</Text>
          {rewardSuggestions(locale).map((s) => (
            <Pressable
              key={s.title}
              onPress={async () => {
                const r = await saveReward(s);
                if (r.error !== null) return setError(r.error);
                void Haptics.selectionAsync();
                onChange();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('shop.addIdea', { title: s.title, price: s.price })}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
            >
              <Text style={styles.emoji}>{s.emoji}</Text>
              <Text style={[typography.body, styles.flex]}>{s.title}</Text>
              <Text style={[typography.caption, { color: CRYSTAL }]}>+ {s.price}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {data.redemptions.length > 0 && (
        <View style={styles.section}>
          <Text style={typography.label}>{t('shop.history')}</Text>
          {data.redemptions.map((h) => (
            <Text key={h.id} style={typography.caption}>
              {t('shop.historyRow', {
                emoji: h.emoji || '🎁',
                title: h.title,
                price: h.price,
                date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
                  new Date(h.redeemedAt),
                ),
              })}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function RewardForm({ initial, onDone }: { initial?: CustomReward; onDone: () => void }) {
  const { t, locale } = useT();
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = { title, emoji: emoji || null, price: Number(price) };
    const invalid = validateReward(value, locale);
    if (invalid) return setError(invalid);
    setSaving(true);
    const r = await saveReward(value, initial?.id);
    setSaving(false);
    if (r.error !== null) return setError(r.error);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  }

  async function remove() {
    if (!initial) return;
    const r = await deleteReward(initial.id);
    if (r.error !== null) return setError(r.error);
    onDone();
  }

  return (
    <View style={styles.form}>
      <View style={styles.formRow}>
        <View style={styles.emojiField}>
          <Field
            label={t('shop.emoji')}
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🎁"
            maxLength={8}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label={t('shop.reward')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('shop.rewardPlaceholder')}
            maxLength={60}
          />
        </View>
      </View>
      <Field
        label={t('shop.price', { min: REWARD_PRICE_MIN, max: REWARD_PRICE_MAX })}
        value={price}
        onChangeText={(t) => setPrice(t.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder="50"
      />
      <FormMessage text={error} />
      <Button
        title={initial ? t('shop.save') : t('shop.createReward')}
        onPress={save}
        loading={saving}
      />
      {initial ? (
        <Button title={t('shop.deleteReward')} variant="danger" onPress={remove} />
      ) : (
        <Button title={t('common.cancel')} variant="secondary" onPress={onDone} />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Cosméticos
// ─────────────────────────────────────────────────────────────
const SLOT_KEY: Record<'aura' | 'outfit' | 'hairColor', 'aura' | 'outfit' | 'hairColor'> = {
  aura: 'aura',
  outfit: 'outfit',
  hairColor: 'hairColor',
};

function Cosmetics({ crystals, onChange }: { crystals: number; onChange: () => void }) {
  const { t, locale } = useT();
  const name = (slot: HeroSlot, item: HeroItem) => itemLabel(slot, item, locale);
  const { hero, save } = useHero();
  const { profile, refresh } = useProfile();
  const owned = profile?.cosmetics ?? new Set<string>();
  const [preview, setPreview] = useState<{ slot: HeroSlot; item: HeroItem } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const look: HeroLook = preview
    ? { ...hero, [SLOT_KEY[preview.slot as keyof typeof SLOT_KEY]]: preview.item.id }
    : hero;

  async function equip(slot: HeroSlot, item: HeroItem) {
    setBusy(item.id);
    const err = await save({ ...hero, [SLOT_KEY[slot as keyof typeof SLOT_KEY]]: item.id });
    setBusy(null);
    if (err) return setError(err);
    void Haptics.selectionAsync();
  }

  function buy(slot: HeroSlot, item: HeroItem) {
    Alert.alert(
      t('shop.buyTitle', { item: name(slot, item) }),
      t('shop.buyText', { price: item.price ?? 0 }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('shop.buy'),
          onPress: async () => {
            setBusy(item.id);
            setError(null);
            const r = await buyCosmetic(item.id);
            if (r.error !== null) {
              setBusy(null);
              return setError(r.error);
            }
            await refresh();
            setBusy(null);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onChange();
            Alert.alert(t('shop.yours', { item: name(slot, item) }), t('shop.useNow'), [
              { text: t('shop.later'), style: 'cancel' },
              { text: t('shop.useNowButton'), onPress: () => void equip(slot, item) },
            ]);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.preview}>
        <HeroAvatar hero={look} size={120} animated />
        <Text style={typography.caption}>
          {preview ? t('shop.preview', { item: name(preview.slot, preview.item) }) : t('shop.tapToPreview')}
        </Text>
      </View>
      <FormMessage text={error} />
      {(['aura', 'outfit', 'hairColor'] as HeroSlot[]).map((slot) => (
        <View key={slot} style={styles.section}>
          <Text style={typography.label}>{slotLabel(slot, locale).toUpperCase()}</Text>
          {SHOP_COSMETICS.filter((c) => c.slot === slot).map(({ item }) => {
            const has = owned.has(item.id);
            const equipped = hero[SLOT_KEY[slot as keyof typeof SLOT_KEY]] === item.id;
            const previewing = preview?.item.id === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setPreview(previewing ? null : { slot, item })}
                accessibilityRole="button"
                accessibilityLabel={t('shop.itemA11y', {
                  item: name(slot, item),
                  status: has ? t('shop.owned') : t('common.crystals', { amount: item.price ?? 0 }),
                })}
                style={({ pressed }) => [
                  styles.cosmetic,
                  previewing && styles.previewing,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: item.color }]} />
                <Text style={[typography.body, styles.flex]}>{name(slot, item)}</Text>
                {has ? (
                  <Button
                    title={equipped ? t('shop.inUse') : t('shop.use')}
                    variant="secondary"
                    disabled={equipped}
                    loading={busy === item.id}
                    onPress={() => void equip(slot, item)}
                  />
                ) : (
                  <Button
                    title={`${item.price}`}
                    loading={busy === item.id}
                    disabled={crystals < (item.price ?? 0)}
                    onPress={() => buy(slot, item)}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={typography.caption}>{t('shop.cosmeticsHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: spacing.sm },
  flex: { flex: 1 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 24 },
  iconButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8 },
  form: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  emojiField: { width: 90 },
  preview: { alignItems: 'center', gap: spacing.xs },
  cosmetic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewing: { borderColor: colors.primary },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
});

export default function ShopScreenRoute() {
  return (
    <FeatureGate feature={FEATURES.shop}>
      <ShopScreen />
    </FeatureGate>
  );
}
