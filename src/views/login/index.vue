<script setup lang="ts">
import { NButton, NCard, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { login } from '@/api'
import { useAppStore, useAuthStore } from '@/store'
import { Captcha, SvgIcon } from '@/components/common'
import { router } from '@/router'
import { t } from '@/locales'
import { languageOptions } from '@/utils/defaultData'
import type { Language } from '@/store/modules/app/helper'
import { getLoginConfig } from '@/api/openness'

// const userStore = useUserStore()
const authStore = useAuthStore()
const appStore = useAppStore()
const ms = useMessage()
const loading = ref(false)
const languageValue = ref<Language>(appStore.language)
const loginCaptcha = ref(false)
const siteSetting = ref<System.SiteSetting>({
  siteTitle: 'ZPanel',
  siteIcon: '/favicon.svg',
  loginTitle: 'ZPanel',
  loginSubtitle: 'A refined self-hosted start page for your services.',
  loginFooter: 'Powered By <a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer">ZPanel</a>',
  customCss: '',
  customJs: '',
})
const captchaId = ref('')
const loginFooterHtml = computed(() => {
  return siteSetting.value.loginFooter || 'Powered By <a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer">ZPanel</a>'
})

// const isShowRegister = ref<boolean>(false)

const form = ref<Login.LoginRequest>({
  username: '',
  password: '',
})

function refreshCaptchaId() {
  captchaId.value = `${Date.now()}${Math.random().toString(36).slice(2)}`
  form.value.email = captchaId.value
  form.value.vcode = ''
}

const loginPost = async () => {
  loading.value = true
  try {
    const res = await login<Login.LoginResponse>(form.value)
    if (res.code === 0) {
      authStore.setToken(res.data.token)
      authStore.setUserInfo(res.data)
      saveSwitchAccount(res.data)

      setTimeout(() => {
        ms.success(`Hi ${res.data.name},${t('login.welcomeMessage')}`)
        loading.value = false
        router.push({ path: '/' })
      }, 500)
    }
    else {
      loading.value = false
      if (loginCaptcha.value)
        refreshCaptchaId()
    }
  }
  catch {
    loading.value = false
    // 请检查网络或者服务器错误
  }
}

function handleSubmit() {
  // 点击登录按钮触发
  loginPost()
}

function handleChangeLanguage(value: Language) {
  languageValue.value = value
  appStore.setLanguage(value)
}

function saveSwitchAccount(data: Login.LoginResponse) {
  const storageKey = 'ZPANEL_ACCOUNTS'
  const accounts = JSON.parse(localStorage.getItem(storageKey) || '[]') as Array<{ token: string; userInfo: User.Info; updatedAt: number }>
  const nextAccounts = accounts.filter(item => item.userInfo.id !== data.id)
  nextAccounts.unshift({ token: data.token, userInfo: data, updatedAt: Date.now() })
  localStorage.setItem(storageKey, JSON.stringify(nextAccounts))
}

onMounted(() => {
  refreshCaptchaId()
  getLoginConfig<Openness.open.LoginVcodeResponse>().then(({ code, data }) => {
    if (code === 0) {
      loginCaptcha.value = data.loginCaptcha
      if (data.siteSetting)
        siteSetting.value = data.siteSetting
    }
  })
})
</script>

<template>
  <div class="login-container">
    <div class="login-shell">
      <div class="login-brand">
        <div class="login-mark">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <h1>{{ siteSetting.loginTitle || siteSetting.siteTitle || $t('common.appName') }}</h1>
          <p>{{ siteSetting.loginSubtitle || 'A refined self-hosted start page for your services.' }}</p>
        </div>
      </div>

      <NCard class="login-card" :bordered="false">
        <div class="login-toolbar">
          <div class="login-language">
            <SvgIcon icon="ion-language" class="login-language-icon" />
            <NSelect v-model:value="languageValue" size="small" :options="languageOptions" @update-value="handleChangeLanguage" />
          </div>
        </div>

        <NForm class="login-form" :model="form" label-width="100px" @keydown.enter="handleSubmit">
          <NFormItem>
            <NInput v-model:value="form.username" :placeholder="$t('login.usernamePlaceholder')" size="large">
              <template #prefix>
                <SvgIcon icon="ph:user-bold" />
              </template>
            </NInput>
          </NFormItem>

          <NFormItem>
            <NInput v-model:value="form.password" type="password" :placeholder="$t('login.passwordPlaceholder')" size="large">
              <template #prefix>
                <SvgIcon icon="mdi:password-outline" />
              </template>
            </NInput>
          </NFormItem>

          <NFormItem v-if="loginCaptcha">
            <div class="captcha-preview">
              <Captcha :src="`/api/captcha/getImageByCaptchaId/${captchaId}/120/34`" />
            </div>
            <NInput v-model:value="form.vcode" type="text" :placeholder="$t('login.captchaPlaceholder')" size="large" />
          </NFormItem>

          <NFormItem class="login-submit">
            <NButton class="login-button" color="#007aff" block size="large" :loading="loading" @click="handleSubmit">
              {{ $t('login.loginButton') }}
            </NButton>
          </NFormItem>
        </NForm>
      </NCard>

      <div class="login-footer" v-html="loginFooterHtml" />
    </div>
  </div>
</template>

<style scoped>
.login-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 32px 18px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(110, 168, 255, 0.28), transparent 30%),
    radial-gradient(circle at 85% 22%, rgba(255, 255, 255, 0.86), transparent 24%),
    linear-gradient(135deg, #eef4ff 0%, #f8fbff 46%, #e8f0ff 100%);
}

.login-container::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.42) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.42) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.34), transparent 72%);
}

.login-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 420px);
}

.login-brand {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 22px;
  color: #111827;
}

.login-mark {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
  width: 52px;
  height: 52px;
  padding: 11px;
  background: linear-gradient(145deg, #007aff, #5ac8fa);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(0, 122, 255, 0.28);
}

.login-mark span {
  display: block;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.24);
}

.login-brand h1 {
  margin: 0;
  font-size: 30px;
  font-weight: 760;
  line-height: 1.05;
  letter-spacing: 0;
}

.login-brand p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.45;
  color: #64748b;
}

.login-card {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 24px;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(24px) saturate(1.35);
}

.login-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 24px;
}

.login-language {
  display: grid;
  grid-template-columns: 20px minmax(112px, 1fr);
  gap: 8px;
  align-items: center;
  width: 154px;
  color: #64748b;
}

.login-language-icon {
  width: 20px;
  height: 20px;
}

.login-form :deep(.n-form-item) {
  --n-label-height: 0;
  margin-bottom: 16px;
}

.login-form :deep(.n-form-item-feedback-wrapper) {
  min-height: 0;
}

.login-form :deep(.n-input) {
  background: rgba(255, 255, 255, 0.74);
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
}

.login-form :deep(.n-input-wrapper) {
  padding-right: 14px;
  padding-left: 14px;
}

.login-form :deep(.n-input__border),
.login-form :deep(.n-input__state-border) {
  border-radius: 14px;
}

.captcha-preview {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  width: 120px;
  height: 40px;
  margin-right: 12px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
}

.login-submit {
  margin-top: 8px;
  margin-bottom: 0;
}

.login-button {
  height: 44px;
  font-size: 15px;
  font-weight: 650;
  border-radius: 14px;
  box-shadow: 0 14px 28px rgba(0, 122, 255, 0.22);
}

.login-button :deep(.n-button__border),
.login-button :deep(.n-button__state-border) {
  border-radius: 14px;
}

.login-footer {
  margin-top: 18px;
  font-size: 13px;
  line-height: 1.5;
  color: #94a3b8;
  text-align: center;
}

.login-footer :deep(a) {
  margin-left: 4px;
  font-weight: 600;
  color: #475569;
  text-decoration: none;
}

.login-footer :deep(a:hover) {
  color: #007aff;
}

:global(.dark) .login-container {
  background:
    radial-gradient(circle at 18% 12%, rgba(64, 156, 255, 0.22), transparent 31%),
    radial-gradient(circle at 82% 16%, rgba(148, 163, 184, 0.12), transparent 24%),
    linear-gradient(135deg, #0f172a 0%, #111827 46%, #172033 100%);
}

:global(.dark) .login-container::before {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
}

:global(.dark) .login-brand {
  color: #f8fafc;
}

:global(.dark) .login-brand p {
  color: #94a3b8;
}

:global(.dark) .login-card {
  background: rgba(15, 23, 42, 0.64);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.36);
}

:global(.dark) .login-language {
  color: #cbd5e1;
}

:global(.dark) .login-form :deep(.n-input) {
  background: rgba(15, 23, 42, 0.64);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
}

:global(.dark) .captcha-preview {
  background: rgba(15, 23, 42, 0.64);
  border-color: rgba(148, 163, 184, 0.2);
}

:global(.dark) .login-footer {
  color: #64748b;
}

:global(.dark) .login-footer :deep(a) {
  color: #cbd5e1;
}

@media (max-width: 520px) {
  .login-container {
    align-items: flex-start;
    padding-top: 54px;
  }

  .login-brand {
    align-items: flex-start;
  }

  .login-brand h1 {
    font-size: 28px;
  }

  .login-brand p {
    font-size: 13px;
  }

  .login-card {
    border-radius: 22px;
  }
}
</style>
