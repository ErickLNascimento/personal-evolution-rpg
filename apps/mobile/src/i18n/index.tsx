import {
  DEFAULT_LOCALE,
  FEATURES,
  resolveLocale,
  type Locale,
  type LocalePreference,
} from '@per/domain';
import { useLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useProfile } from '@/features/profile/useProfile';
import { setCurrentLocale, translate, type TKey, type TParams } from './translate';

export {
  currentLocale,
  t,
  translate,
  type TKey,
  type TParams,
  type Translations,
} from './translate';

/**
 * Tradução do app. O dicionário em português (pt.ts) é a fonte; en.ts precisa ter as mesmas
 * chaves (o TypeScript reclama se faltar alguma). Uso: `const { t } = useT(); t('today.title')`.
 * Variáveis entre chaves: t('mission.xp', { xp: 20 }) com 'mission.xp': '+{xp} XP'.
 *
 * Idioma: com a flag feature_english desligada, sempre português. Ligada, segue o celular
 * (pt → português, o resto → inglês) ou a escolha feita no Perfil.
 */

const PREF_KEY = 'per.locale';
const ENGLISH_KEY = 'per.feature.english';

function loadPreference(): LocalePreference {
  const v = globalThis.localStorage?.getItem(PREF_KEY);
  return v === 'pt-BR' || v === 'en' ? v : 'auto';
}

interface LocaleState {
  locale: Locale;
  preference: LocalePreference;
  setPreference: (p: LocalePreference) => void;
  t: (key: TKey, params?: TParams) => string;
}

const LocaleContext = createContext<LocaleState>({
  locale: DEFAULT_LOCALE,
  preference: 'auto',
  setPreference: () => undefined,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Sem perfil (tela de login), vale o último estado conhecido da flag neste aparelho.
  const { profile } = useProfile();
  const englishOn = profile
    ? profile.features.has(FEATURES.english)
    : globalThis.localStorage?.getItem(ENGLISH_KEY) === '1';
  useEffect(() => {
    if (profile) globalThis.localStorage?.setItem(ENGLISH_KEY, englishOn ? '1' : '0');
  }, [profile, englishOn]);
  const device = useLocales(); // re-renderiza se o idioma do celular mudar
  const [preference, setPref] = useState<LocalePreference>(loadPreference);
  const locale: Locale = englishOn
    ? resolveLocale(
        device.map((l) => l.languageTag),
        preference,
      )
    : DEFAULT_LOCALE;
  // Idioma para o código fora do React (mensagens das APIs, lembretes).
  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale]);

  const setPreference = useCallback((p: LocalePreference) => {
    globalThis.localStorage?.setItem(PREF_KEY, p);
    setPref(p);
  }, []);
  const tr = useCallback((key: TKey, params?: TParams) => translate(locale, key, params), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, preference, setPreference, t: tr }}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Idioma atual e a função de tradução. */
export function useT() {
  return useContext(LocaleContext);
}
