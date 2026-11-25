import { DEFAULT_LOCALE, type Locale } from '@per/domain';
import en from './en';
import pt from './pt';

/**
 * Parte pura da tradução (sem React nem perfil): dicionários, chaves e t() fora de componentes.
 * Fica separada de index.tsx para que módulos usados pelo LocaleProvider (como o perfil)
 * possam traduzir sem criar um ciclo de imports.
 */

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Chaves válidas, a partir do dicionário em português. */
export type TKey = Leaves<typeof pt>;

/** Formato que cada tradução precisa seguir: as mesmas chaves do português, com textos. */
export type Translations<T = typeof pt> = {
  [K in keyof T]: T[K] extends string ? string : Translations<T[K]>;
};

const DICTS: Record<Locale, Translations> = { 'pt-BR': pt, en };

export type TParams = Record<string, string | number>;

function lookup(dict: Translations, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(locale: Locale, key: TKey, params?: TParams): string {
  const text = lookup(DICTS[locale], key) ?? lookup(DICTS[DEFAULT_LOCALE], key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    params[name] === undefined ? m : String(params[name]),
  );
}

// Idioma atual também fora do React (lembretes, mensagens de API).
let current: Locale = DEFAULT_LOCALE;

/** Atualizado pelo LocaleProvider. */
export function setCurrentLocale(locale: Locale): void {
  current = locale;
}

export function currentLocale(): Locale {
  return current;
}

/** Tradução fora de componentes (usa o idioma atual). */
export function t(key: TKey, params?: TParams): string {
  return translate(current, key, params);
}

