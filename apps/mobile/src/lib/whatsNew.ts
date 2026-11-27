import {
  LATEST_RELEASE_NOTE_VERSION,
  RELEASE_NOTES,
  releaseItemText,
  splitReleaseItems,
  type Locale,
  type ReleaseNoteItem,
} from '@per/domain';
import type { TourSlide } from '@/components/tour/AppTour';
import { t } from '@/i18n';
import { colors } from '@/theme/tokens';

/**
 * Última nota de novidades vista, guardada neste aparelho (localStorage; no celular ele vem do
 * expo-sqlite, instalado em lib/supabase.ts). Reinstalar o app mostra a nota mais recente de novo.
 */
const KEY = 'per.whatsNew.seenVersion';

export function seenNewsVersion(): number {
  const raw = globalThis.localStorage?.getItem(KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Marca como vistas todas as notas até a mais recente. */
export function markNewsSeen(version = LATEST_RELEASE_NOTE_VERSION) {
  globalThis.localStorage?.setItem(KEY, String(version));
}

const COLORS = [colors.primary, colors.accent, colors.xp, '#5CF2E0', colors.danger];

/**
 * Slides das novidades: um por recurso novo. Correções de bug não ganham slide: viram uma lista
 * no último slide (ou num slide só delas, se a atualização só trouxe correções).
 */
export function newsSlides(items: readonly ReleaseNoteItem[], locale?: Locale): TourSlide[] {
  const { features, fixes } = splitReleaseItems(items);
  const slides: TourSlide[] = features.map((item, i) => ({
    icon: item.icon as TourSlide['icon'],
    color: COLORS[i % COLORS.length]!,
    ...releaseItemText(item, locale),
    route: item.route,
  }));
  if (fixes.length === 0) return slides;
  const notes = fixes.map((item) => releaseItemText(item, locale).text);
  const last = slides[slides.length - 1];
  if (last) last.notes = notes;
  else
    slides.push({
      icon: 'construct',
      color: colors.accent,
      title: t('tour.fixesOnlyTitle'),
      text: t('tour.fixesOnlyText'),
      notes,
    });
  return slides;
}

/** Itens da nota mais recente (para rever pelo Perfil), sem os de feature flag desligada. */
export function latestNewsSlides(
  features: ReadonlySet<string> = new Set(),
  locale?: Locale,
): TourSlide[] {
  return newsSlides(
    (RELEASE_NOTES[0]?.items ?? []).filter((i) => !i.flag || features.has(i.flag)),
    locale,
  );
}

/** Itens da nota mais recente (para rever pelo Perfil), sem os de feature flag desligada. */
export function latestNewsItems(features: ReadonlySet<string> = new Set()): ReleaseNoteItem[] {
  return (RELEASE_NOTES[0]?.items ?? []).filter((i) => !i.flag || features.has(i.flag));
}
