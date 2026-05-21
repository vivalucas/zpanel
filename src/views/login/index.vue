<script setup lang="ts">
import { NButton, NCard, NForm, NFormItem, NGradientText, NInput, NSelect, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
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
  loginSubtitle: '',
  loginFooter: 'Powered By ZPanel',
  customCss: '',
  customJs: '',
})
const captchaId = ref('')

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
    <NCard class="login-card" style="border-radius: 20px;">
      <div class="mb-5 flex items-center justify-end">
        <div class="mr-2">
          <SvgIcon icon="ion-language" style="width: 20;height: 20;" />
        </div>
        <div class="min-w-[100px]">
          <NSelect v-model:value="languageValue" size="small" :options="languageOptions" @update-value="handleChangeLanguage" />
        </div>
      </div>

      <div class="login-title  ">
        <NGradientText :size="30" type="success" class="!font-bold">
          {{ siteSetting.loginTitle || siteSetting.siteTitle || $t('common.appName') }}
        </NGradientText>
        <div v-if="siteSetting.loginSubtitle" class="mt-2 text-slate-500 text-sm">
          {{ siteSetting.loginSubtitle }}
        </div>
      </div>
      <NForm :model="form" label-width="100px" @keydown.enter="handleSubmit">
        <NFormItem>
          <NInput v-model:value="form.username" :placeholder="$t('login.usernamePlaceholder')">
            <template #prefix>
              <SvgIcon icon="ph:user-bold" />
            </template>
          </NInput>
        </NFormItem>

        <NFormItem>
          <NInput v-model:value="form.password" type="password" :placeholder="$t('login.passwordPlaceholder')">
            <template #prefix>
              <SvgIcon icon="mdi:password-outline" />
            </template>
          </NInput>
        </NFormItem>

        <NFormItem v-if="loginCaptcha">
          <div class="w-[120px] h-[34px] mr-[20px] rounded border flex cursor-pointer">
            <Captcha :src="`/api/captcha/getImageByCaptchaId/${captchaId}/120/34`" />
          </div>
          <NInput v-model:value="form.vcode" type="text" :placeholder="$t('login.captchaPlaceholder')" />
        </NFormItem>
        <NFormItem style="margin-top: 10px">
          <NButton type="primary" block :loading="loading" @click="handleSubmit">
            {{ $t('login.loginButton') }}
          </NButton>
        </NFormItem>

        <!-- <div class="flex justify-end">
          <NButton v-if="isShowRegister" quaternary type="info" class="flex" @click="$router.push({ path: '/register' })">
            注册
          </NButton>
          <NButton quaternary type="info" class="flex" @click="$router.push({ path: '/resetPassword' })">
            忘记密码?
          </NButton>
        </div> -->

        <div class="flex justify-center text-slate-300" v-text="siteSetting.loginFooter" />
      </NForm>
    </NCard>
  </div>
</template>

  <style scoped>
    .login-container {
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #f2f6ff;
    }

    /* 夜间模式 */
    :global(.dark) .login-container{
      background-color: rgb(43, 43, 43);
    }

    @media (min-width: 600px) {
        .login-card {
            width: auto;
            margin: 0px 10px;
        }
        .login-button {
            width: 100%;
        }
    }

    .login-card {
        margin: 20px;
        min-width:400px;
    }

  .login-title{
    text-align: center;
    margin: 20px;
  }
  </style>
