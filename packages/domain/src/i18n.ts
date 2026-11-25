/**
 * Idiomas do app. O português é a fonte; o inglês é a tradução. Funções do domínio que produzem
 * texto recebem `locale` (padrão 'pt-BR'), então quem não passa nada continua em português.
 */
export type Locale = 'pt-BR' | 'en';
export const LOCALES: readonly Locale[] = ['pt-BR', 'en'];
export const DEFAULT_LOCALE: Locale = 'pt-BR';

/** Preferência salva no aparelho: seguir o celular ou fixar um idioma. */
export type LocalePreference = 'auto' | Locale;

/**
 * Idioma a usar a partir dos idiomas do celular (em ordem de preferência, ex.: ['en-US', 'pt-BR']):
 * português para qualquer variante de pt; inglês para o resto.
 */
export function resolveLocale(
  deviceTags: readonly string[],
  preference: LocalePreference = 'auto',
): Locale {
  if (preference !== 'auto') return preference;
  const first = (deviceTags[0] ?? '').toLowerCase();
  return first.startsWith('pt') ? 'pt-BR' : 'en';
}

/** Texto nos dois idiomas, escolhido pelo `locale`. */
export type Bilingual<T = string> = Record<Locale, T>;

export function pick<T>(text: Bilingual<T>, locale: Locale = DEFAULT_LOCALE): T {
  return text[locale];
}
