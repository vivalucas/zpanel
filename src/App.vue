<script setup lang="ts">
import { NConfigProvider } from 'naive-ui'
import { onMounted } from 'vue'
import { NaiveProvider } from '@/components/common'
import { useTheme } from '@/hooks/useTheme'
import { useLanguage } from '@/hooks/useLanguage'
import { getLoginConfig } from '@/api/openness'

const { theme, themeOverrides } = useTheme()
const { language } = useLanguage()

function applySiteSetting(siteSetting?: System.SiteSetting) {
  if (!siteSetting)
    return

  document.title = siteSetting.siteTitle || 'ZPanel'

  const iconHref = siteSetting.siteIcon || '/favicon.svg'
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!icon) {
    icon = document.createElement('link')
    icon.rel = 'icon'
    document.head.appendChild(icon)
  }
  icon.href = iconHref

  let customStyle = document.getElementById('zpanel-custom-css')
  if (!customStyle) {
    customStyle = document.createElement('style')
    customStyle.id = 'zpanel-custom-css'
    document.head.appendChild(customStyle)
  }
  customStyle.textContent = siteSetting.customCss || ''

  const oldScript = document.getElementById('zpanel-custom-js')
  oldScript?.remove()
  if (siteSetting.customJs) {
    const script = document.createElement('script')
    script.id = 'zpanel-custom-js'
    script.textContent = siteSetting.customJs
    document.body.appendChild(script)
  }
}

onMounted(() => {
  getLoginConfig<Openness.open.LoginVcodeResponse>().then(({ code, data }) => {
    if (code === 0)
      applySiteSetting(data.siteSetting)
  })
})
</script>

<template>
  <NConfigProvider
    class="h-full"
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="language"
  >
    <NaiveProvider>
      <RouterView />
    </NaiveProvider>
  </NConfigProvider>
</template>
