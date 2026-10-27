import type { Locale } from 'antd/es/locale'
import enUS from 'antd/locale/en_US'

export const fallbackAntdLocale = enUS
const loaders: Record<string, () => Promise<{ default: Locale }>> = {
	'zh-CN': () => import('antd/locale/zh_CN'),
	'zh-TW': () => import('antd/locale/zh_TW'),
	'de-DE': () => import('antd/locale/de_DE'),
	'es-ES': () => import('antd/locale/es_ES'),
	'fr-FR': () => import('antd/locale/fr_FR'),
	'it-IT': () => import('antd/locale/it_IT'),
	'ja-JP': () => import('antd/locale/ja_JP'),
	'ko-KR': () => import('antd/locale/ko_KR'),
	'pt-BR': () => import('antd/locale/pt_BR'),
	'ru-RU': () => import('antd/locale/ru_RU'),
}
const loaded = new Map<string, Locale>([['en-US', enUS]])
const pending = new Map<string, Promise<Locale>>()

export function cachedAntdLocale(language: string): Locale {
	return loaded.get(language) || fallbackAntdLocale
}

export function loadAntdLocale(language: string): Promise<Locale> {
	const cached = loaded.get(language)
	if (cached) return Promise.resolve(cached)
	const load = Object.hasOwn(loaders, language) ? loaders[language] : undefined
	if (!load) return Promise.resolve(fallbackAntdLocale)
	let promise = pending.get(language)
	if (!promise) {
		promise = load()
			.then(({ default: locale }) => {
				loaded.set(language, locale)
				return locale
			})
			.catch(() => fallbackAntdLocale)
			.finally(() => pending.delete(language))
		pending.set(language, promise)
	}
	return promise
}
