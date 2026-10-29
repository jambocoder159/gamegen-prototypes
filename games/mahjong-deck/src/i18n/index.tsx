// i18n provider. Holds the loaded dictionaries, the active language (persisted &
// validated), sets <html lang> + document.title, and exposes t()/tier().
// Missing or empty keys fall back to English.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LANG_CODES, LANG_NAMES, isLangCode, browserLanguage, type Dict, type LangCode } from './dict';

const STORAGE_KEY = 'mahjong-deck.lang';

function lookup(dict: Dict | null | undefined, path: string): string | undefined {
  if (!dict) return undefined;
  let cur: string | Dict | undefined = dict;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Dict)[part];
    else return undefined;
  }
  return typeof cur === 'string' && cur.length > 0 ? cur : undefined;
}

function interpolate(tpl: string, params?: Record<string, string | number>): string {
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export interface I18n {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  cycleLang: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  langName: (code: LangCode) => string;
  codes: LangCode[];
}

const I18nContext = createContext<I18n | null>(null);

function initialLang(): LangCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLangCode(saved)) return saved;
  } catch {
    /* ignore */
  }
  return browserLanguage(navigator.languages ?? [navigator.language]);
}

export function I18nProvider({
  dicts,
  children,
}: {
  dicts: Record<LangCode, Dict | null>;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<LangCode>(initialLang);

  const setLang = useCallback((code: LangCode) => {
    if (!isLangCode(code)) return;
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  }, []);

  const cycleLang = useCallback(() => {
    setLangState((cur) => {
      const i = LANG_CODES.indexOf(cur);
      const next = LANG_CODES[(i + 1) % LANG_CODES.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const val = lookup(dicts[lang], key) ?? lookup(dicts.en, key) ?? key;
      return interpolate(val, params);
    },
    [dicts, lang],
  );

  // keep <html lang> + title in sync with the active dictionary
  useEffect(() => {
    const htmlLang = lookup(dicts[lang], 'lang') ?? lang;
    document.documentElement.lang = htmlLang;
    const title = lookup(dicts[lang], 'documentTitle') ?? lookup(dicts.en, 'documentTitle');
    if (title) document.title = title;
  }, [dicts, lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      cycleLang,
      t,
      langName: (code: LangCode) => LANG_NAMES[code],
      codes: LANG_CODES,
    }),
    [lang, setLang, cycleLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
