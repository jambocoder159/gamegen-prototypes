// Minimal i18n: four languages, live switch, English fallback for missing keys.

import { useSyncExternalStore } from 'react';

export const LANGS = ['en', 'zh-tw', 'zh-cn', 'ja'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

const STORE_KEY = 'noodle_night_lang';
// <html lang> uses canonical BCP-47 tags
const HTML_LANG: Record<Lang, string> = {
  en: 'en',
  'zh-tw': 'zh-Hant-TW',
  'zh-cn': 'zh-Hans-CN',
  ja: 'ja',
};

type Dict = Record<string, unknown>;

let dicts: Record<string, Dict> = {};
let current: Lang = DEFAULT_LANG;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function browserLanguage(languages: readonly string[]): Lang {
  for (const value of languages) {
    const tag = value.toLowerCase();
    if (/^zh-(tw|hk|mo|hant)(-|$)/.test(tag)) return 'zh-tw';
    if (tag === 'zh' || /^zh-(cn|sg|hans)(-|$)/.test(tag)) return 'zh-cn';
    if (/^ja(-|$)/.test(tag)) return 'ja';
    if (/^en(-|$)/.test(tag)) return 'en';
  }
  return DEFAULT_LANG;
}

export function initI18n(loaded: Record<string, Dict>): void {
  dicts = loaded;
  let initial: Lang = browserLanguage(navigator.languages);
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (isLang(saved)) initial = saved;
  } catch {
    /* ignore */
  }
  current = initial;
  applyHtmlLang();
}

function applyHtmlLang(): void {
  try {
    document.documentElement.lang = HTML_LANG[current];
    document.title = translate('title');
  } catch {
    /* ignore */
  }
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (!isLang(lang) || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {
    /* ignore */
  }
  applyHtmlLang();
  emit();
}

export function cycleLang(): void {
  const i = LANGS.indexOf(current);
  setLang(LANGS[(i + 1) % LANGS.length]);
}

function lookup(dict: Dict | undefined, key: string): unknown {
  if (!dict) return undefined;
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

export function translate(key: string, params?: Record<string, string | number>): string {
  let val = lookup(dicts[current], key);
  if (typeof val !== 'string') val = lookup(dicts[DEFAULT_LANG], key);
  if (typeof val !== 'string') return key;
  if (params) {
    return val.replace(/\{(\w+)\}/g, (_m, p: string) =>
      p in params ? String(params[p]) : `{${p}}`,
    );
  }
  return val;
}

// React binding: re-renders consumers on language change.
export function useI18n(): {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  cycleLang: () => void;
} {
  const lang = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
  return { lang, t: translate, setLang, cycleLang };
}
