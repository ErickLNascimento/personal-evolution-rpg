import { Ionicons } from '@expo/vector-icons';
import {
  formLabel,
  HERO_FORMS,
  pathLabel,
  pathMotto,
  RACES,
  raceDescription,
  raceLabel,
  rarityLabel,
  stageName,
  titleDescription,
  titleHint,
  type HeroForm,
  type Race,
  type HeroLook,
  type HeroSlot,
  displayedTitle,
  hasTitle,
  RARITY_COLOR,
  RARITY_ORDER,
  TITLE_IDS,
  titleInfo,
  titleName,
  type TitleId,
} from '@per/domain';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Fragment, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chips } from '@/components/Chips';
import { Button, FormMessage } from '@/components/Form';
import { HeroAvatar } from '@/components/hero/HeroAvatar';
import { PathTree } from '@/components/hero/PathTree';
import { tierColor } from '@/components/hero/HeroCard';
import {
  GOLD,
  InventoryPicker,
  Ornament,
  WardrobeStage,
  WardrobeTabs,
  type WardrobeTab,
} from '@/components/hero/Wardrobe';
import { StackScreen } from '@/components/Screen';
import { useCelebration } from '@/features/celebration/CelebrationProvider';
import { useHero } from '@/features/hero/useHero';
import { useProfile } from '@/features/profile/ProfileProvider';
import { useT } from '@/i18n';
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
  const { t, locale } = useT();
  const { profile, update } = useProfile();
  const heroPath = profile?.heroPath;
  const initialRace: Race = profile?.race ?? 'humano';
  const [race, setRace] = useState<Race>(initialRace);
  const earned = profile?.earnedTitles ?? new Set<string>();
  const initialTitle = displayedTitle(profile?.equippedTitle, level, earned);
  const [title, setTitle] = useState<TitleId>(initialTitle);
  const { celebrateLevelUp } = useCelebration();
  const [look, setLook] = useState<HeroLook>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = tierColor(level);
  const titleChanged = title !== initialTitle;
  const raceChanged = race !== initialRace;
  const dirty = JSON.stringify(look) !== JSON.stringify(initial) || titleChanged || raceChanged;

  // Cada escolha faz o herói comemorar no pedestal.
  const [cheer, setCheer] = useState(0);
  const { width } = useWindowDimensions();
  const pager = useRef<Animated.ScrollView>(null);
  const progress = useSharedValue(0);
  const [tab, setTab] = useState(0);
  // As abas só montam quando visitadas (cada peça desenha miniaturas do herói).
  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set([0]));

  const tabs: WardrobeTab[] = [
    { key: 'hero', icon: 'person', label: t('heroScreen.tabHero') },
    { key: 'look', icon: 'color-palette', label: t('heroScreen.tabLook') },
    { key: 'gear', icon: 'shield', label: t('heroScreen.tabGear') },
    { key: 'title', icon: 'ribbon', label: t('heroScreen.tabTitle') },
    { key: 'path', icon: 'git-branch', label: t('heroScreen.tabPath') },
  ];

  function show(i: number) {
    setTab(i);
    setVisited((v) => (v.has(i) ? v : new Set(v).add(i)));
  }

  function selectTab(i: number) {
    void Haptics.selectionAsync();
    show(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  }

  const onScroll = useAnimatedScrollHandler((e) => {
    progress.set(e.contentOffset.x / width);
  });

  function choose(next: Partial<HeroLook>) {
    void Haptics.selectionAsync();
    setLook((l) => ({ ...l, ...next }));
    setCheer((c) => c + 1);
  }

  async function submit() {
    setSaving(true);
    // Título e aparência são salvos juntos; o banco confere se o título foi conquistado.
    const err =
      titleChanged || raceChanged
        ? await update({ hero: look, race, ...(titleChanged ? { equipped_title: title } : {}) })
        : await save(look);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  const owned = profile?.cosmetics ?? new Set<string>();
  const slotPicker = (slot: HeroSlot) => (
    <InventoryPicker
      key={slot}
      slot={slot}
      look={{ ...look, race }}
      value={look[SLOT_KEY[slot]]}
      level={level}
      owned={owned}
      onChoose={(id) => choose({ [SLOT_KEY[slot]]: id })}
    />
  );

  const pages = [
    // Herói: forma e raça
    <Fragment key="hero">
      <Ornament>{t('heroScreen.character')}</Ornament>
      <View style={styles.forms}>
        {HERO_FORMS.map((f: HeroForm) => {
          const active = look.form === f;
          return (
            <Pressable
              key={f}
              onPress={() => choose({ form: f })}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={formLabel(f, locale)}
              style={({ pressed }) => [
                styles.formCard,
                active && styles.formActive,
                pressed && styles.pressed,
              ]}
            >
              <HeroAvatar hero={{ ...look, race, form: f, aura: 'nenhuma' }} size={52} />
              <Text style={typography.body}>{formLabel(f, locale)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Ornament>{t('heroScreen.race')}</Ornament>
      <Chips
        options={RACES.map((r) => ({ value: r, label: raceLabel(r, look.form, locale) }))}
        selected={[race]}
        onToggle={(r) => {
          void Haptics.selectionAsync();
          setRace(r);
          setCheer((c) => c + 1);
        }}
      />
      <Text style={typography.caption}>
        {raceDescription(race, locale)} {t('heroScreen.raceHint')}
      </Text>
    </Fragment>,
    // Visual: pele, olhos e cabelo
    <Fragment key="look">{(['skin', 'eyes', 'hair', 'hairColor'] as HeroSlot[]).map(slotPicker)}</Fragment>,
    // Equipamento: roupa, acessório e aura
    <Fragment key="gear">
      {(['outfit', 'accessory', 'aura'] as HeroSlot[]).map(slotPicker)}
      <Button
        title={t('heroScreen.preview', { level: level + 1 })}
        onPress={() => celebrateLevelUp(level, level + 1)}
        variant="secondary"
      />
    </Fragment>,
    // Título
    <TitlePicker
      key="title"
      value={title}
      level={level}
      earned={earned}
      form={look.form}
      onChoose={(id) => {
        void Haptics.selectionAsync();
        setTitle(id);
        setCheer((c) => c + 1);
      }}
    />,
    // Caminho
    <Fragment key="path">
      <Ornament>{t('heroScreen.path')}</Ornament>
      {heroPath?.path ? (
        <>
          <Text style={[typography.heading, styles.center]}>{pathLabel(heroPath.path, locale)}</Text>
          <PathTree state={{ ...heroPath, path: heroPath.path }} form={look.form} />
        </>
      ) : (
        <Text style={typography.body}>{t('heroScreen.noPathYet')}</Text>
      )}
      <Button
        title={heroPath?.path ? t('heroScreen.changePath') : t('heroScreen.choosePath')}
        onPress={() => router.push('/path')}
        variant="secondary"
      />
    </Fragment>,
  ];

  return (
    <View style={styles.screen}>
      {/* Herói fixo no topo: cada escolha aparece nele na hora. */}
      <WardrobeStage
        hero={{ ...look, race }}
        cheer={cheer}
        frame={frame}
        title={titleName(title, look.form, locale).toUpperCase()}
        titleColor={RARITY_COLOR[titleInfo(title).rarity]}
        subtitle={
          heroPath?.path
            ? stageName(heroPath.path, heroPath.branch, heroPath.stage, look.form, locale)
            : t('heroScreen.noPath')
        }
        caption={
          heroPath?.path
            ? `${t('heroScreen.raceLevel', { race: raceLabel(race, look.form, locale), level })} · ${pathMotto(heroPath.path, locale)}`
            : t('heroScreen.raceLevel', { race: raceLabel(race, look.form, locale), level })
        }
      />

      <WardrobeTabs tabs={tabs} index={tab} progress={progress} width={width} onSelect={selectTab} />

      {/* Páginas lado a lado: deslizar troca de aba, e o marcador acompanha o dedo. */}
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => show(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.flex}
      >
        {pages.map((page, i) => (
          <ScrollView
            key={tabs[i]!.key}
            style={{ width }}
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
          >
            {visited.has(i) ? page : <ActivityIndicator color={GOLD} />}
          </ScrollView>
        ))}
      </Animated.ScrollView>

      {/* Salvar sempre à mão, sem precisar rolar até o fim. */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <FormMessage text={error} />
        <Button
          title={dirty ? t('heroScreen.seal') : t('heroScreen.done')}
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
  const { t, locale } = useT();
  const [showLocked, setShowLocked] = useState(false);
  const mine = TITLE_IDS.filter((id) => hasTitle(id, level, earned)).sort(
    (a, b) => RARITY_ORDER[titleInfo(b).rarity] - RARITY_ORDER[titleInfo(a).rarity],
  );
  const locked = TITLE_IDS.filter((id) => !hasTitle(id, level, earned));

  return (
    <View style={styles.slot}>
      <Ornament>{t('heroScreen.shownTitle')}</Ornament>
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
              accessibilityLabel={`${titleName(id, form, locale)}, ${rarityLabel(info.rarity, locale)}. ${titleDescription(id, locale)}`}
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
                  {titleName(id, form, locale)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={typography.caption}>{titleDescription(value, locale)}</Text>

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
          {t(showLocked ? 'heroScreen.hideLocked' : 'heroScreen.showLocked', { count: locked.length })}
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
                  ? t('heroScreen.secretA11y', { hint: titleHint(id, locale) ?? '' })
                  : `${titleName(id, form, locale)}: ${titleDescription(id, locale)}`
              }
            >
              <Ionicons
                name={secret ? 'help-circle' : 'lock-closed'}
                size={16}
                color={RARITY_COLOR[info.rarity]}
              />
              <View style={styles.flex}>
                <Text style={typography.body}>{secret ? '???' : titleName(id, form, locale)}</Text>
                <Text style={typography.caption}>
                  {secret
                    ? t('heroScreen.hint', { hint: titleHint(id, locale) ?? '' })
                    : titleDescription(id, locale)}
                </Text>
              </View>
              <Text style={[styles.rarityTag, { color: RARITY_COLOR[info.rarity] }]}>
                {rarityLabel(info.rarity, locale)}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  page: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  center: { textAlign: 'center' },
  formActive: { borderColor: GOLD, backgroundColor: '#3A2F1E' },
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
  forms: { flexDirection: 'row', gap: spacing.sm },
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
