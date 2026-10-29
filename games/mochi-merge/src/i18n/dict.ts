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

export function browserLang(languages: readonly string[]): LangCode {
  for (const value of languages) {
    const code = value.toLowerCase();
    if (/^zh(?:-|$)/.test(code)) {
      return /(?:^|-)(tw|hk|mo|hant)(?:-|$)/.test(code) ? 'zh-tw' : 'zh-cn';
    }
    if (/^ja(?:-|$)/.test(code)) return 'ja';
    if (/^en(?:-|$)/.test(code)) return 'en';
  }
  return 'en';
}
