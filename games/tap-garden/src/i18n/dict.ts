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
