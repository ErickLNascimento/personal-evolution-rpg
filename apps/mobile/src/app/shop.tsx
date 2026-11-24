import { Ionicons } from '@expo/vector-icons';
import {
  HERO_SLOTS,
  REWARD_PRICE_MAX,
  REWARD_PRICE_MIN,
  REWARD_SUGGESTIONS,
  SHOP_COSMETICS,
  validateReward,
  type HeroItem,
  type HeroLook,
  type HeroSlot,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { CrystalBadge, CRYSTAL } from '@/components/crystals/Crystals';
import { Button, Field, FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
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

type Tab = 'rewards' | 'cosmetics';
const TABS = [
  { value: 'rewards' as const, label: 'Recompensas' },
  { value: 'cosmetics' as const, label: 'Cosméticos' },
];

const DATE = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

/** Loja: recompensas da vida real (criadas pelo usuário) e cosméticos do herói, pagos com Cristais. */
export default function ShopScreen() {
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
        <Text style={typography.label}>SEU SALDO</Text>
        <CrystalBadge amount={shop.data.crystals} />
      </View>
      <Chips options={TABS} selected={[tab]} onToggle={setTab} />
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
  const [editing, setEditing] = useState<CustomReward | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function redeem(r: CustomReward) {
    Alert.alert(`Resgatar "${r.title}"?`, `Custa ${r.price} Cristais. Aproveite, você mereceu!`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resgatar',
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
    ]);
  }

  return (
    <View style={styles.section}>
      <Text style={typography.body}>
        Crie prêmios da vida real e troque pelos Cristais que você ganha nas missões.
      </Text>
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
              <Text style={[typography.caption, { color: CRYSTAL }]}>{r.price} Cristais</Text>
            </View>
            <Pressable
              onPress={() => setEditing(r)}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${r.title}`}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
            </Pressable>
            <Button
              title="Resgatar"
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
        <Button title="Nova recompensa" variant="secondary" onPress={() => setEditing('new')} />
      )}

      {data.rewards.length === 0 && editing === null && (
        <View style={styles.section}>
          <Text style={typography.label}>IDEIAS PARA COMEÇAR</Text>
          {REWARD_SUGGESTIONS.map((s) => (
            <Pressable
              key={s.title}
              onPress={async () => {
                const r = await saveReward(s);
                if (r.error !== null) return setError(r.error);
                void Haptics.selectionAsync();
                onChange();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Adicionar ${s.title}, ${s.price} Cristais`}
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
          <Text style={typography.label}>ÚLTIMOS RESGATES</Text>
          {data.redemptions.map((h) => (
            <Text key={h.id} style={typography.caption}>
              {h.emoji || '🎁'} {h.title} · {h.price} Cristais ·{' '}
              {DATE.format(new Date(h.redeemedAt))}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function RewardForm({ initial, onDone }: { initial?: CustomReward; onDone: () => void }) {
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = { title, emoji: emoji || null, price: Number(price) };
    const invalid = validateReward(value);
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
            label="Emoji"
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🎁"
            maxLength={8}
          />
        </View>
        <View style={styles.flex}>
          <Field
            label="Recompensa"
            value={title}
            onChangeText={setTitle}
            placeholder="Ver um episódio"
            maxLength={60}
          />
        </View>
      </View>
      <Field
        label={`Preço (${REWARD_PRICE_MIN} a ${REWARD_PRICE_MAX} Cristais)`}
        value={price}
        onChangeText={(t) => setPrice(t.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder="50"
      />
      <FormMessage text={error} />
      <Button title={initial ? 'Salvar' : 'Criar recompensa'} onPress={save} loading={saving} />
      {initial ? (
        <Button title="Apagar recompensa" variant="danger" onPress={remove} />
      ) : (
        <Button title="Cancelar" variant="secondary" onPress={onDone} />
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
    Alert.alert(`Comprar ${item.label}?`, `Custa ${item.price} Cristais.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Comprar',
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
          Alert.alert(`${item.label} é seu!`, 'Quer usar agora?', [
            { text: 'Depois', style: 'cancel' },
            { text: 'Usar agora', onPress: () => void equip(slot, item) },
          ]);
        },
      },
    ]);
  }

  return (
    <View style={styles.section}>
      <View style={styles.preview}>
        <HeroAvatar hero={look} size={120} animated />
        <Text style={typography.caption}>
          {preview ? `Prévia: ${preview.item.label}` : 'Toque num item para ver no seu herói.'}
        </Text>
      </View>
      <FormMessage text={error} />
      {(['aura', 'outfit', 'hairColor'] as HeroSlot[]).map((slot) => (
        <View key={slot} style={styles.section}>
          <Text style={typography.label}>{HERO_SLOTS[slot].label.toUpperCase()}</Text>
          {SHOP_COSMETICS.filter((c) => c.slot === slot).map(({ item }) => {
            const has = owned.has(item.id);
            const equipped = hero[SLOT_KEY[slot as keyof typeof SLOT_KEY]] === item.id;
            const previewing = preview?.item.id === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setPreview(previewing ? null : { slot, item })}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}, ${has ? 'comprado' : `${item.price} Cristais`}`}
                style={({ pressed }) => [
                  styles.cosmetic,
                  previewing && styles.previewing,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.swatch, { backgroundColor: item.color }]} />
                <Text style={[typography.body, styles.flex]}>{item.label}</Text>
                {has ? (
                  <Button
                    title={equipped ? 'Em uso' : 'Usar'}
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
      <Text style={typography.caption}>
        Cosméticos são só visuais: não mudam XP nem Cristais. Depois de comprados, também aparecem
        na tela do herói.
      </Text>
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
