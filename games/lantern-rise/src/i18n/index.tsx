// i18n provider. All player-visible text comes from the loaded language JSONs.
// Missing keys/values fall back to English, then to the key itself.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LANG,
  browserLanguage,
  isLangCode,
  LANG_ORDER,
  type Dict,
  type LangCode,
} from './langs';

const LS_KEY = 'lantern-rise.lang';

function resolve(dict: Dict | undefined, key: string): string | undefined {
  if (!dict) return undefined;
  const parts = key.split('.');
  let cur: string | Dict | undefined = dict;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Dict)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function format(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export type TFunc = (key: string, params?: Record<string, string | number>) => string;

interface I18nValue {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  cycleLang: () => void;
  t: TFunc;
  availableLangs: LangCode[];
}

const I18nContext = createContext<I18nValue | null>(null);

function detectInitialLang(dicts: Map<LangCode, Dict>): LangCode {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (isLangCode(stored) && dicts.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  const browser = browserLanguage(navigator.languages ?? [navigator.language]);
  if (dicts.has(browser)) return browser;
  return dicts.has(DEFAULT_LANG) ? DEFAULT_LANG : (LANG_ORDER.find((l) => dicts.has(l)) ?? DEFAULT_LANG);
}

export function applyHtmlLang(lang: LangCode): void {
  try {
    document.documentElement.lang = lang;
  } catch {
    /* ignore */
  }
}

export function I18nProvider({
  dicts,
  children,
}: {
  dicts: Map<LangCode, Dict>;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<LangCode>(() => {
    const initial = detectInitialLang(dicts);
    applyHtmlLang(initial);
    return initial;
  });

  const available = useMemo(() => LANG_ORDER.filter((l) => dicts.has(l)), [dicts]);

  const setLang = useCallback(
    (l: LangCode) => {
      if (!dicts.has(l)) return;
      setLangState(l);
      applyHtmlLang(l);
      try {
        localStorage.setItem(LS_KEY, l);
      } catch {
        /* ignore */
      }
    },
    [dicts],
  );

  const cycleLang = useCallback(() => {
    const list = available.length ? available : [DEFAULT_LANG];
    const idx = list.indexOf(lang);
    setLang(list[(idx + 1) % list.length]);
  }, [available, lang, setLang]);

  const t = useCallback<TFunc>(
    (key, params) => {
      const val = resolve(dicts.get(lang), key) ?? resolve(dicts.get(DEFAULT_LANG), key);
      return format(val ?? key, params);
    },
    [dicts, lang],
  );

  // Document title comes from the language JSON and follows the live language.
  useEffect(() => {
    try {
      document.title = t('title');
    } catch {
      /* ignore */
    }
  }, [t]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, cycleLang, t, availableLangs: available }),
    [lang, setLang, cycleLang, t, available],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
