import { ss } from '@/utils/storage'

const LOCAL_NAME = 'appSetting'

export type Theme = 'light' | 'dark' | 'auto'

export type Language =
  | 'zh-CN'
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | 'de-DE'
  | 'fr-FR'
  | 'es-ES'
  | 'pt-BR'
  | 'it-IT'
  | 'zh-TW'
  | 'ru-RU'

export interface AppState {
  siderCollapsed: boolean
  theme: Theme
  language: Language
}

export function defaultSetting(): AppState {
  const lan = (navigator.language).toLowerCase()
  let language: Language = 'en-US'
  if (lan.includes('zh-tw') || lan.includes('zh-hk') || lan.includes('zh-mo'))
    language = 'zh-TW'
  else if (lan.includes('zh'))
    language = 'zh-CN'
  else if (lan.includes('ja'))
    language = 'ja-JP'
  else if (lan.includes('ko'))
    language = 'ko-KR'
  else if (lan.includes('de'))
    language = 'de-DE'
  else if (lan.includes('fr'))
    language = 'fr-FR'
  else if (lan.includes('es'))
    language = 'es-ES'
  else if (lan.includes('pt'))
    language = 'pt-BR'
  else if (lan.includes('it'))
    language = 'it-IT'
  else if (lan.includes('ru'))
    language = 'ru-RU'

  return { siderCollapsed: false, theme: 'auto', language }
}

export function getLocalSetting(): AppState {
  const localSetting: AppState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalSetting(setting: AppState): void {
  ss.set(LOCAL_NAME, setting)
}

export function removeLocalState() {
  ss.remove(LOCAL_NAME)
}
