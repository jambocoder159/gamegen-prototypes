import type {LangCode} from './dict';
export function detectLanguage(languages:readonly string[]):LangCode {
 for(const language of languages){const l=language.toLowerCase();if(/^zh-(tw|hk|mo|hant)/.test(l))return 'zh-tw';if(/^zh($|-cn|-sg|-hans)/.test(l))return 'zh-cn';if(/^ja/.test(l))return 'ja';return 'en';}return 'en';
}
