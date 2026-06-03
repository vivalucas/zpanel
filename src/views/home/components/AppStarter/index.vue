<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NLayout, NLayoutContent, NLayoutSider, NSpace } from 'naive-ui'
import { useAuthStore } from '@/store'
import { AppLoader, RoundCardModal, SvgIcon } from '@/components/common'
import { t } from '@/locales'

interface App {
  name: string
  componentName: string
  icon: string
  auth?: number
}
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', visible: boolean): void
}>()

const componentName = ref('UserInfo')
const collapsed = ref(false)
const screenWidth = ref(0)
const isSmallScreen = ref(false)
const defaultTitle = t('appLauncher.title')
const title = ref('')
const height = ref('500px')

const apps = ref<App[]>([
  {
    name: t('apps.userInfo.appName'),
    componentName: 'UserInfo',
    icon: 'material-symbols-person-edit-outline-rounded',
  },
  {
    name: t('apps.baseSettings.appName'),
    componentName: 'Style',
    icon: 'ion-color-palette-outline',
  },
  {
    name: t('apps.itemGroupManage.appName'),
    componentName: 'ItemGroupManage',
    icon: 'material-symbols-ad-group-outline-rounded',
  },
  {
    name: t('apps.uploadsFileManager.appName'),
    componentName: 'UploadFileManager',
    icon: 'tabler:file-upload',
  },
  {
    name: t('apps.exportImport.appName'),
    componentName: 'ImportExport',
    icon: 'icon-park-outline-import-and-export',
  },
  {
    name: t('apps.about.appName'),
    componentName: 'About',
    icon: 'lucide-info',
  },
])

const authStore = useAuthStore()

const show = computed({
  get: () => props.visible,
  set: (visible: boolean) => {
    emit('update:visible', visible)
  },
})

function handleClickApp(item: App) {
  componentName.value = item.componentName
  if (isSmallScreen.value)
    collapsed.value = true
}

function getScreenWidth() {
  return window.innerWidth
}

function handleResize() {
  screenWidth.value = getScreenWidth()
  if (screenWidth.value < 640) {
    collapsed.value = true
    isSmallScreen.value = true
  }
  else {
    collapsed.value = false
    isSmallScreen.value = false
  }
}

onMounted(() => {
  const adminApp: App = {
    name: t('adminSettingUsers.appName'),
    componentName: 'Users',
    icon: 'lucide-users',
    auth: 1,
  }
  const dockerApp: App = {
    name: t('apps.dockerManager.appName'),
    componentName: 'DockerManager',
    icon: 'majesticons-applications',
    auth: 1,
  }
  // 初始化
  if (authStore.userInfo?.role === 1) {
    apps.value.push(adminApp)
    apps.value.push(dockerApp)
  }

  window.addEventListener('resize', handleResize)
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div>
    <RoundCardModal
      v-model:show="show"
      style="max-width: 900px;"
      size="small"
    >
      <template #header>
        <div class="app-starter-header" @click="collapsed = !collapsed">
          <div class="app-starter-toggle">
            <SvgIcon class=" transition-all duration-500" :icon="collapsed ? 'tabler-layout-sidebar-right-collapse-filled' : 'tabler-layout-sidebar-left-collapse-filled'" />
          </div>
          <div>
            {{ title === '' ? defaultTitle : title }}
          </div>
        </div>
      </template>
      <div class="w-full h-full app-starter-modal-content">
        <NSpace vertical size="large" style="height: 100%;width: 100%;">
          <NLayout has-sider class="app-starter-layout">
            <NLayoutSider
              v-model:collapsed="collapsed"
              collapse-mode="width"
              :collapsed-width="0"
              :width="isSmallScreen ? '100%' : 240"
              class="app-starter-sider"
              content-style="overflow: hidden"
            >
              <div class="w-full h-full">
                <div
                  class="app-starter-nav"
                  :style="{
                    width: isSmallScreen ? '100%' : '220px',
                    minWidth: '200px',
                    height,
                  }"
                >
                  <div
                    v-for="item in apps"
                    :key="item.componentName"
                    class="app-starter-nav-item"
                    :class="{ active: componentName === item.componentName }"
                    @click="handleClickApp(item)"
                  >
                    <div class="app-starter-nav-button">
                      <div class="app-starter-nav-icon">
                        <SvgIcon :icon="item.icon" />
                      </div>
                      <span>{{ item.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </NLayoutSider>
            <NLayoutContent class="app-starter-content" :content-style="{ height }">
              <div class="app-starter-content-inner" :class="(isSmallScreen && !collapsed) ? 'opacity-0' : 'opacity-100'">
                <AppLoader :component-name="componentName" class="h-full" />
              </div>
            </NLayoutContent>
          </NLayout>
        </NSpace>
      </div>
    </RoundCardModal>
  </div>
</template>

<style scoped>
.app-starter-header {
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 760;
  color: #111827;
  cursor: pointer;
  user-select: none;
}

.app-starter-toggle {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 10px;
}

.app-starter-layout {
  background: transparent;
  border-radius: 20px;
}

.app-starter-sider {
  height: 100%;
  background: transparent;
}

.app-starter-nav {
  height: 100%;
  padding: 8px;
  overflow: auto;
  background: rgba(241, 245, 249, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 18px;
}

.app-starter-nav-item {
  margin-bottom: 6px;
}

.app-starter-nav-button {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid transparent;
  border-radius: 14px;
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.app-starter-nav-button:hover {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.88);
  transform: translateY(-1px);
}

.app-starter-nav-item.active .app-starter-nav-button {
  color: #007aff;
  background: rgba(0, 122, 255, 0.1);
  border-color: rgba(0, 122, 255, 0.16);
}

.app-starter-nav-icon {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  font-size: 18px;
}

.app-starter-content {
  background: transparent;
}

.app-starter-content-inner {
  height: 100%;
  min-width: 300px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 18px;
  transition: opacity 0.3s ease;
}

:global(.dark) .app-starter-header {
  color: #f8fafc;
}

:global(.dark) .app-starter-nav {
  background: rgba(15, 23, 42, 0.62);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark) .app-starter-nav-button {
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.62);
}

:global(.dark) .app-starter-nav-button:hover {
  color: #f8fafc;
  background: rgba(30, 41, 59, 0.72);
}

:global(.dark) .app-starter-content-inner {
  background: rgba(15, 23, 42, 0.56);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
