import { Ionicons } from '@expo/vector-icons';
import {
  CLASS_CATALOG,
  HERO_CLASS_INFO,
  ownsClass,
  heroClassLabel,
  HERO_FORM_LABEL,
  HERO_FORMS,
  HERO_CLASSES,
  HERO_SLOTS,
  isUnlocked,
  type HeroClass,
  type HeroForm,
  type HeroItem,
  type HeroLook,
  type HeroSlot,
  displayedTitle,
  hasTitle,
  RARITY_COLOR,
  RARITY_LABEL,
  RARITY_ORDER,
  TITLE_IDS,
  titleInfo,
  titleName,
  type TitleId,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { tierColor } from '@/components/hero/HeroCard';
import { StackScreen } from '@/components/Screen';
import { useCelebration } from '@/features/celebration/CelebrationProvider';
import { useHero } from '@/features/hero/useHero';
import { useProfile } from '@/features/profile/ProfileProvider';
import { colors, MIN_TOUCH, radius, spacing, typography } from '@/theme/tokens';

const SLOT_KEY: Record<HeroSlot, keyof Omit<HeroLook, 'heroClass' | 'form' | 'kit' | 'tier' | 'race'>> = {
  skin: 'skin',
  eyes: 'eyes',
  hair: 'hair',
  hairColor: 'hairColor',
  outfit: 'outfit',
  aura: 'aura',
  accessory: 'accessory',
};

export default function HeroScreen() {
  const { hero, level, loading } = useHero();
  if (loading) {
    return (
      <StackScreen>
        <ActivityIndicator color={colors.primary} />
      </StackScreen>
    );
  }
  // Remonta quando o herói salvo muda, para o rascunho partir dele.
  return <HeroEditor key={JSON.stringify(hero)} initial={hero} level={level.level} />;
}

function HeroEditor({ initial, level }: { initial: HeroLook; level: number }) {
  const { save } = useHero();
  const { profile, update } = useProfile();
  const owned = profile?.owned ?? new Set<string>();
  const earned = profile?.earnedTitles ?? new Set<string>();
  const initialTitle = displayedTitle(profile?.equippedTitle, level, earned);
  const [title, setTitle] = useState<TitleId>(initialTitle);
  const { celebrateLevelUp } = useCelebration();
  const [look, setLook] = useState<HeroLook>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = tierColor(level);
  const titleChanged = title !== initialTitle;
  const dirty = JSON.stringify(look) !== JSON.stringify(initial) || titleChanged;

  function choose(next: Partial<HeroLook>) {
    void Haptics.selectionAsync();
    setLook((l) => ({ ...l, ...next }));
  }

  async function submit() {
    setSaving(true);
    // Título e aparência são salvos juntos; o banco confere se o título foi conquistado.
    const err = titleChanged
      ? await update({ hero: look, equipped_title: title })
      : await save(look);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <View style={styles.screen}>
      {/* Herói fixo no topo: cada escolha aparece nele na hora, enquanto as opções rolam embaixo. */}
      <View style={[styles.stage, { borderColor: frame }]}>
        <View style={styles.portrait}>
          <HeroAvatar hero={look} size={112} animated />
        </View>
        <View style={styles.stageInfo}>
          <Text style={[styles.title, { color: RARITY_COLOR[titleInfo(title).rarity] }]}>
            {titleName(title, look.form).toUpperCase()}
          </Text>
          <Text style={typography.heading}>{heroClassLabel(look.heroClass, look.form)}</Text>
          <Text style={typography.caption}>Nível {level}</Text>
          <Text style={typography.caption}>{HERO_CLASS_INFO[look.heroClass].motto}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <TitlePicker
          value={title}
          level={level}
          earned={earned}
          form={look.form}
          onChoose={(id) => {
            void Haptics.selectionAsync();
            setTitle(id);
          }}
        />

        <Text style={typography.label}>PERSONAGEM</Text>
        <View style={styles.forms}>
          {HERO_FORMS.map((f: HeroForm) => {
            const active = look.form === f;
            return (
              <Pressable
                key={f}
                onPress={() => choose({ form: f })}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={HERO_FORM_LABEL[f]}
                style={({ pressed }) => [
                  styles.formCard,
                  active && { borderColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <HeroAvatar hero={{ ...look, form: f, aura: 'nenhuma' }} size={52} />
                <Text style={typography.body}>{HERO_FORM_LABEL[f]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={typography.label}>CLASSE</Text>
        <View style={styles.classes}>
          {HERO_CLASSES.map((c: HeroClass) => {
            const active = look.heroClass === c;
            // Classe paga ainda não comprada: cadeado e atalho para a Loja.
            const usable = ownsClass(c, owned);
            return (
              <Pressable
                key={c}
                onPress={() => (usable ? choose({ heroClass: c }) : router.push('/shop'))}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: !usable }}
                accessibilityLabel={
                  usable
                    ? `${heroClassLabel(c, look.form)}. ${HERO_CLASS_INFO[c].motto}`
                    : `${heroClassLabel(c, look.form)}, bloqueada. Toque para ver na Loja.`
                }
                style={({ pressed }) => [
                  styles.classCard,
                  active && { borderColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <View style={!usable && styles.locked}>
                  <HeroAvatar hero={{ ...look, heroClass: c, aura: 'nenhuma' }} size={56} />
                </View>
                <Text style={typography.body}>{heroClassLabel(c, look.form)}</Text>
                {usable ? (
                  <Text style={[typography.caption, styles.center]}>
                    {HERO_CLASS_INFO[c].motto}
                  </Text>
                ) : (
                  <View style={styles.classLock}>
                    <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                    <Text style={typography.caption}>
                      Nv {CLASS_CATALOG[c].minLevel} · {CLASS_CATALOG[c].price} Cristais
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {(Object.keys(HERO_SLOTS) as HeroSlot[]).map((slot) => (
          <SlotPicker
            key={slot}
            slot={slot}
            value={look[SLOT_KEY[slot]]}
            level={level}
            onChoose={(id) => choose({ [SLOT_KEY[slot]]: id })}
          />
        ))}

        <Button
          title={`Prévia: cena do nível ${level + 1}`}
          onPress={() => celebrateLevelUp(level, level + 1)}
          variant="secondary"
        />
      </ScrollView>

      {/* Salvar sempre à mão, sem precisar rolar até o fim. */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <FormMessage text={error} />
        <Button
          title={dirty ? 'Salvar herói' : 'Pronto'}
          onPress={dirty ? submit : () => router.back()}
          loading={saving}
        />
      </SafeAreaView>
    </View>
  );
}

/** Títulos: os conquistados podem ser exibidos; os outros mostram como conquistar (secretos, só a pista). */
function TitlePicker({
  value,
  level,
  earned,
  form,
  onChoose,
}: {
  value: TitleId;
  level: number;
  earned: ReadonlySet<string>;
  form: HeroLook['form'];
  onChoose: (id: TitleId) => void;
}) {
  const [showLocked, setShowLocked] = useState(false);
  const mine = TITLE_IDS.filter((id) => hasTitle(id, level, earned)).sort(
    (a, b) => RARITY_ORDER[titleInfo(b).rarity] - RARITY_ORDER[titleInfo(a).rarity],
  );
  const locked = TITLE_IDS.filter((id) => !hasTitle(id, level, earned));

  return (
    <View style={styles.slot}>
      <Text style={typography.label}>TÍTULO EXIBIDO</Text>
      <View style={styles.options}>
        {mine.map((id) => {
          const info = titleInfo(id);
          const color = RARITY_COLOR[info.rarity];
          const active = id === value;
          return (
            <Pressable
              key={id}
              onPress={() => onChoose(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${titleName(id, form)}, ${RARITY_LABEL[info.rarity]}. ${info.description}`}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: active ? color : colors.border },
                active && styles.titleActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.chipRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.chipText, active && { color: colors.text }]}>
                  {titleName(id, form)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={typography.caption}>{titleInfo(value).description}</Text>

      <Pressable
        onPress={() => setShowLocked((v) => !v)}
        accessibilityRole="button"
        style={styles.lockedToggle}
      >
        <Ionicons
          name={showLocked ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textSecondary}
        />
        <Text style={typography.caption}>
          {showLocked ? 'Esconder' : 'Ver'} títulos a conquistar ({locked.length})
        </Text>
      </Pressable>
      {showLocked &&
        locked.map((id) => {
          const info = titleInfo(id);
          const secret = info.kind === 'secret';
          return (
            <View
              key={id}
              style={styles.lockedTitle}
              accessible
              accessibilityLabel={
                secret
                  ? `Título secreto. Pista: ${info.hint}`
                  : `${titleName(id, form)}: ${info.description}`
              }
            >
              <Ionicons
                name={secret ? 'help-circle' : 'lock-closed'}
                size={16}
                color={RARITY_COLOR[info.rarity]}
              />
              <View style={styles.flex}>
                <Text style={typography.body}>{secret ? '???' : titleName(id, form)}</Text>
                <Text style={typography.caption}>
                  {secret ? `Pista: ${info.hint}` : info.description}
                </Text>
              </View>
              <Text style={[styles.rarityTag, { color: RARITY_COLOR[info.rarity] }]}>
                {RARITY_LABEL[info.rarity]}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

function SlotPicker({
  slot,
  value,
  level,
  onChoose,
}: {
  slot: HeroSlot;
  value: string;
  level: number;
  onChoose: (id: string) => void;
}) {
  const { label, items } = HERO_SLOTS[slot];
  const isColor = items.every((i) => i.color) && slot !== 'aura';
  return (
    <View style={styles.slot}>
      <Text style={typography.label}>{label.toUpperCase()}</Text>
      <View style={styles.options}>
        {items.map((item: HeroItem) => {
          const unlocked = isUnlocked(item, level);
          const active = item.id === value;
          const a11y = unlocked ? item.label : `${item.label}, bloqueado até o nível ${item.level}`;
          return (
            <Pressable
              key={item.id}
              onPress={() =>
                unlocked
                  ? onChoose(item.id)
                  : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
              }
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !unlocked }}
              accessibilityLabel={a11y}
              style={({ pressed }) => [
                isColor ? styles.swatch : styles.chip,
                isColor && { backgroundColor: item.color },
                active && styles.active,
                !unlocked && styles.locked,
                pressed && styles.pressed,
              ]}
            >
              {!isColor && (
                <View style={styles.chipRow}>
                  {item.color && <View style={[styles.dot, { backgroundColor: item.color }]} />}
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {item.label}
                  </Text>
                </View>
              )}
              {!unlocked && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={10} color={colors.text} />
                  <Text style={styles.lockText}>{item.level}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  portrait: { width: 120, alignItems: 'center' },
  stageInfo: { flex: 1, gap: 2 },
  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4 },
  classes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  forms: { flexDirection: 'row', gap: spacing.sm },
  classLock: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  titleActive: { borderWidth: 3 },
  lockedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH,
  },
  lockedTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rarityTag: { fontSize: 11, fontWeight: '800' },
  formCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  classCard: {
    width: '48%',
    alignItems: 'center',
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  center: { textAlign: 'center' },
  slot: { gap: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
  },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.text },
  active: { borderColor: colors.primary, borderWidth: 3 },
  locked: { opacity: 0.45 },
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
  },
  lockText: { fontSize: 10, fontWeight: '800', color: colors.text },
});
