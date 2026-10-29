// Compact, locale-aware number formatting for dew counts and costs. Uses
// Intl.NumberFormat with compact notation (1.2K, 3.4M in English; 1.2万 in
// Japanese/Chinese) so there are no hard-coded suffix strings. Formatters are
// cached per locale.

import type { LangCode } from '../i18n/dict';

const LOCALE: Record<LangCode, string> = {
  en: 'en',
  'zh-tw': 'zh-TW',
  'zh-cn': 'zh-CN',
  ja: 'ja',
};

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string): Intl.NumberFormat {
  let f = cache.get(locale);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    } catch {
      f = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
    }
    cache.set(locale, f);
  }
  return f;
}

/** Format a dew amount compactly. Small values (<1000) show as whole numbers. */
export function formatDew(value: number, lang: LangCode): string {
  const v = Math.floor(value);
  return formatter(LOCALE[lang] ?? 'en').format(v);
}

/** Format a per-second rate; keeps one decimal for small rates. */
export function formatRate(value: number, lang: LangCode): string {
  const locale = LOCALE[lang] ?? 'en';
  if (value > 0 && value < 1000) {
    try {
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
    } catch {
      /* fall through to compact */
    }
  }
  return formatter(locale).format(value);
}
