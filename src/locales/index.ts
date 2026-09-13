import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { usePreferences } from '@/app/store'
import en from './en-US.json'
import zh from './zh-CN.json'
const messages = import.meta.glob<Record<string, unknown>>(['./*.json', '!./en-US.json', '!./zh-CN.json'], {
	import: 'default',
})
void i18n.use(initReactI18next).init({
	resources: { 'en-US': { translation: en }, 'zh-CN': { translation: zh } },
	lng: usePreferences.getState().language,
	fallbackLng: 'en-US',
	interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
})
let requestedLanguage = usePreferences.getState().language
export async function setLanguage(language: string) {
	requestedLanguage = language
	if (!i18n.hasResourceBundle(language, 'translation')) {
		const load = messages[`./${language}.json`]
		if (load) i18n.addResourceBundle(language, 'translation', await load())
	}
	if (requestedLanguage === language) await i18n.changeLanguage(language)
}
export default i18n
export const languageOptions = [
	['zh-CN', '简体中文'],
	['zh-TW', '繁體中文'],
	['en-US', 'English'],
	['ja-JP', '日本語'],
	['ko-KR', '한국어'],
	['de-DE', 'Deutsch'],
	['es-ES', 'Español'],
	['fr-FR', 'Français'],
	['it-IT', 'Italiano'],
	['pt-BR', 'Português'],
	['ru-RU', 'Русский'],
].map(([value, label]) => ({ value, label }))
