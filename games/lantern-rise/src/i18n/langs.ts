// Language metadata shared by the loader and the i18n provider.

export type LangCode = 'en' | 'zh-TW' | 'zh-CN' | 'ja';

export const LANG_FILES: Record<LangCode, string> = {
  en: 'en.json',
  'zh-TW': 'zh-tw.json',
  'zh-CN': 'zh-cn.json',
  ja: 'ja.json',
};

// Cycle order for the globe button; en is the default/fallback.
export const LANG_ORDER: LangCode[] = ['en', 'zh-TW', 'zh-CN', 'ja'];

export const DEFAULT_LANG: LangCode = 'en';

export type Dict = { [k: string]: string | Dict };

export function isLangCode(x: unknown): x is LangCode {
  return typeof x === 'string' && (LANG_ORDER as string[]).includes(x);
}

export function browserLanguage(languages: readonly string[]): LangCode {
  for (const language of languages) {
    const code = language.toLowerCase();
    if (/^zh-(tw|hk|mo|hant)(-|$)/.test(code)) return 'zh-TW';
    if (/^zh($|-)/.test(code)) return 'zh-CN';
    if (/^ja($|-)/.test(code)) return 'ja';
    if (/^en($|-)/.test(code)) return 'en';
  }
  return 'en';
}
