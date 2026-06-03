<script setup lang="ts">
import { NTag } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { get } from '@/api/system/about'
import srcGithub from '@/assets/about_image/github.png'

interface Version {
  versionName: string
  versionCode: number
}

const versionName = ref('')
const frontVersion = import.meta.env.VITE_APP_VERSION || 'unknown'

onMounted(() => {
  get<Version>().then((res) => {
    if (res.code === 0)
      versionName.value = res.data.versionName
  })
})
</script>

<template>
  <div class="about-panel">
    <div class="about-hero">
      <div class="about-mark">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div class="about-title">
        <div class="text-3xl font-semibold">
          {{ $t('common.appName') }}
        </div>
        <a href="https://github.com/vivalucas/zpanel/releases" class="about-version" :title="$t('apps.about.viewUpdateLog')" target="_blank" rel="noopener noreferrer">v{{ versionName }}</a>
      </div>
    </div>

    <div class="about-card">
      <div class="about-row">
        {{ $t('apps.about.maintainer') }}<a href="https://github.com/vivalucas" target="_blank" rel="noopener noreferrer" class="link">vivalucas</a>
      </div>
      <div class="about-row">
        {{ $t('apps.about.issue') }}<a href="https://github.com/vivalucas/zpanel/issues" target="_blank" rel="noopener noreferrer" class="link">Github Issues</a>
      </div>

      <div class="about-links">
        <div class="about-link-item">
          <img class="w-[20px] h-[20px] mr-[5px]" :src="srcGithub" alt="">
          <a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer" class="link">Github</a>
        </div>
        <a href="https://github.com/vivalucas/zpanel/releases" target="_blank" rel="noopener noreferrer" class="link">{{ $t('apps.about.checkUpdate') }}</a>
      </div>

      <div class="about-tag">
        <NTag :bordered="false" size="small">
          {{ $t("apps.about.frontVersionText") }}: FV-{{ frontVersion }}
        </NTag>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 48px 24px;
  color: #111827;
}

.about-hero {
  display: flex;
  gap: 16px;
  align-items: center;
}

.about-mark {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
  width: 56px;
  height: 56px;
  padding: 12px;
  background: linear-gradient(145deg, #007aff, #5ac8fa);
  border-radius: 18px;
  box-shadow: 0 16px 36px rgba(0, 122, 255, 0.24);
}

.about-mark span {
  display: block;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 6px;
}

.about-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-version {
  width: fit-content;
  font-size: 16px;
  font-weight: 700;
  color: #007aff;
  text-decoration: none;
}

.about-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  width: min(100%, 420px);
  padding: 22px;
  font-size: 15px;
  color: #475569;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 20px;
}

.about-row {
  text-align: center;
}

.about-links {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  flex-wrap: wrap;
}

.about-link-item {
  display: flex;
  align-items: center;
}

.about-tag {
  margin-top: 8px;
}

.link {
  color: #007aff;
  font-weight: 650;
  text-decoration: none;
}

.link:hover,
.about-version:hover {
  text-decoration: underline;
}

:global(.dark) .about-panel {
  color: #f8fafc;
}

:global(.dark) .about-card {
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.42);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
