import { computed } from 'vue'
import { deDE, enUS, frFR, itIT, jaJP, koKR, ptBR, ruRU, zhCN, zhTW } from 'naive-ui'
import { useAppStore } from '@/store'
import { setLocale } from '@/locales'
import type { SupportedLocale } from '@/locales'

const naiveLocaleMap: Record<string, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'de-DE': deDE,
  'es-ES': enUS,
  'fr-FR': frFR,
  'it-IT': itIT,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'zh-TW': zhTW,
}

export function useLanguage() {
  const appStore = useAppStore()

  const language = computed(() => {
    const locale = appStore.language as SupportedLocale
    setLocale(locale)
    return naiveLocaleMap[locale] ?? zhCN
  })

  return { language }
}
