// Language codes (also the JSON filenames under public/config/language/) and
// their display names for the language menu. `en` is the default/fallback.

export type LangCode = 'en' | 'zh-tw' | 'zh-cn' | 'ja';

export const LANG_CODES: LangCode[] = ['en', 'zh-tw', 'zh-cn', 'ja'];

export const LANG_NAMES: Record<LangCode, string> = {
  en: 'English',
  'zh-tw': '繁體中文',
  'zh-cn': '简体中文',
  ja: '日本語',
};

export type Dict = { [key: string]: string | Dict };

export function isLangCode(x: unknown): x is LangCode {
  return typeof x === 'string' && (LANG_CODES as string[]).includes(x);
}

/** First supported browser preference; unknown languages fall back to English. */
export function browserLanguage(languages: readonly string[]): LangCode {
  for (const value of languages) {
    const tag = value.toLowerCase();
    if (/^zh-(tw|hk|mo|hant)(-|$)/.test(tag)) return 'zh-tw';
    if (/^zh($|-)/.test(tag)) return 'zh-cn';
    if (/^ja($|-)/.test(tag)) return 'ja';
    if (/^en($|-)/.test(tag)) return 'en';
  }
  return 'en';
}
