import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import deDE from './de-DE.json'
import enUS from './en-US.json'
import esES from './es-ES.json'
import frFR from './fr-FR.json'
import itIT from './it-IT.json'
import jaJP from './ja-JP.json'
import koKR from './ko-KR.json'
import ptBR from './pt-BR.json'
import ruRU from './ru-RU.json'
import zhCN from './zh-CN.json'
import zhTW from './zh-TW.json'

const defaultLocale = 'zh-CN'

const i18n = createI18n({
  locale: defaultLocale,
  fallbackLocale: defaultLocale,
  allowComposition: true,
  messages: {
    'de-DE': deDE,
    'en-US': enUS,
    'es-ES': esES,
    'fr-FR': frFR,
    'it-IT': itIT,
    'ja-JP': jaJP,
    'ko-KR': koKR,
    'pt-BR': ptBR,
    'ru-RU': ruRU,
    'zh-CN': zhCN,
    'zh-TW': zhTW,
  },
})

export const t = i18n.global.t

export type SupportedLocale = 'zh-CN' | 'en-US' | 'de-DE' | 'es-ES' | 'fr-FR' | 'it-IT' | 'ja-JP' | 'ko-KR' | 'pt-BR' | 'ru-RU' | 'zh-TW'

export function setLocale(locale: SupportedLocale) {
  i18n.global.locale = locale
}

export function setupI18n(app: App) {
  app.use(i18n)
}

export default i18n
