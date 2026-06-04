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
      class="zpanel-settings-modal"
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
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.64), rgba(248, 251, 255, 0.38));
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.64);
  backdrop-filter: blur(22px) saturate(1.22);
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

<style>
.zpanel-settings-modal {
  --zpanel-blue: #007aff;
  --zpanel-blue-hover: #0a84ff;
  --zpanel-blue-pressed: #006edb;
  --zpanel-danger: #ff3b30;
  --zpanel-danger-hover: #ff453a;
  --zpanel-danger-pressed: #d70015;
  --zpanel-text: #111827;
  --zpanel-muted: #64748b;
  --zpanel-line: rgba(148, 163, 184, 0.2);
  --zpanel-glass: rgba(255, 255, 255, 0.68);
  --zpanel-glass-strong: rgba(255, 255, 255, 0.82);
}

.zpanel-settings-modal .n-card__content {
  background:
    radial-gradient(circle at 12% 0%, rgba(0, 122, 255, 0.08), transparent 28%),
    linear-gradient(135deg, rgba(247, 250, 255, 0.82), rgba(255, 255, 255, 0.64));
}

.zpanel-settings-modal .zpanel-settings-page {
  height: 100%;
  padding: 10px;
  overflow: auto;
  color: var(--zpanel-text);
  background: transparent !important;
}

.zpanel-settings-modal .n-card {
  --n-border-radius: 18px !important;
  --n-color: var(--zpanel-glass) !important;
  --n-color-modal: var(--zpanel-glass) !important;
  --n-border-color: rgba(255, 255, 255, 0.74) !important;
  --n-box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08) !important;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.74);
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(20px) saturate(1.2);
}

.zpanel-settings-modal .n-card + .n-card {
  margin-top: 12px !important;
}

.zpanel-settings-modal .n-button {
  --n-border-radius: 12px !important;
  --n-font-weight: 700 !important;
  min-height: 34px;
  border-radius: 12px !important;
}

.zpanel-settings-modal .n-button--primary-type {
  --n-color: var(--zpanel-blue) !important;
  --n-color-hover: var(--zpanel-blue-hover) !important;
  --n-color-pressed: var(--zpanel-blue-pressed) !important;
  --n-color-focus: var(--zpanel-blue-hover) !important;
  --n-border: 1px solid rgba(0, 122, 255, 0.2) !important;
  --n-border-hover: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-border-pressed: 1px solid rgba(0, 122, 255, 0.34) !important;
  --n-border-focus: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-text-color: #fff !important;
  --n-text-color-hover: #fff !important;
  --n-text-color-pressed: #fff !important;
  --n-text-color-focus: #fff !important;
  box-shadow: 0 10px 24px rgba(0, 122, 255, 0.22);
}

.zpanel-settings-modal .n-button--primary-type.n-button--disabled {
  --n-color-disabled: rgba(0, 122, 255, 0.1) !important;
  --n-border-disabled: 1px solid rgba(0, 122, 255, 0.14) !important;
  --n-text-color-disabled: rgba(0, 91, 181, 0.48) !important;
  box-shadow: none;
}

.zpanel-settings-modal .n-button--error-type {
  --n-color: rgba(255, 59, 48, 0.1) !important;
  --n-color-hover: rgba(255, 59, 48, 0.16) !important;
  --n-color-pressed: rgba(255, 59, 48, 0.22) !important;
  --n-color-focus: rgba(255, 59, 48, 0.16) !important;
  --n-border: 1px solid rgba(255, 59, 48, 0.2) !important;
  --n-border-hover: 1px solid rgba(255, 59, 48, 0.28) !important;
  --n-border-pressed: 1px solid rgba(255, 59, 48, 0.34) !important;
  --n-border-focus: 1px solid rgba(255, 59, 48, 0.28) !important;
  --n-text-color: var(--zpanel-danger) !important;
  --n-text-color-hover: var(--zpanel-danger-hover) !important;
  --n-text-color-pressed: var(--zpanel-danger-pressed) !important;
  --n-text-color-focus: var(--zpanel-danger-hover) !important;
  box-shadow: none;
}

.zpanel-settings-modal .n-button--warning-type,
.zpanel-settings-modal .n-button--success-type,
.zpanel-settings-modal .n-button--info-type,
.zpanel-settings-modal .n-button--default-type {
  --n-color: rgba(255, 255, 255, 0.62) !important;
  --n-color-hover: rgba(255, 255, 255, 0.82) !important;
  --n-color-pressed: rgba(241, 245, 249, 0.9) !important;
  --n-color-focus: rgba(255, 255, 255, 0.82) !important;
  --n-border: 1px solid rgba(148, 163, 184, 0.22) !important;
  --n-border-hover: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-border-pressed: 1px solid rgba(0, 122, 255, 0.34) !important;
  --n-border-focus: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-text-color: #334155 !important;
  --n-text-color-hover: var(--zpanel-blue) !important;
  --n-text-color-pressed: var(--zpanel-blue-pressed) !important;
  --n-text-color-focus: var(--zpanel-blue) !important;
  box-shadow: none;
}

.zpanel-settings-modal .n-input,
.zpanel-settings-modal .n-input-number,
.zpanel-settings-modal .n-base-selection {
  --n-border-radius: 12px !important;
  --n-color: rgba(255, 255, 255, 0.66) !important;
  --n-color-focus: rgba(255, 255, 255, 0.88) !important;
  --n-border: 1px solid rgba(148, 163, 184, 0.24) !important;
  --n-border-hover: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-border-focus: 1px solid rgba(0, 122, 255, 0.42) !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(0, 122, 255, 0.12) !important;
}

.zpanel-settings-modal .n-switch.n-switch--active .n-switch__rail {
  background-color: var(--zpanel-blue) !important;
}

.zpanel-settings-modal .n-slider {
  --n-fill-color: var(--zpanel-blue) !important;
  --n-fill-color-hover: var(--zpanel-blue-hover) !important;
}

.zpanel-settings-modal .n-alert {
  --n-border-radius: 16px !important;
  background: rgba(0, 122, 255, 0.08) !important;
  border: 1px solid rgba(0, 122, 255, 0.12) !important;
}

.zpanel-settings-modal .n-data-table {
  --n-border-radius: 16px !important;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 16px;
}

.zpanel-settings-modal .n-data-table-th,
.zpanel-settings-modal .n-data-table-td {
  background: transparent !important;
}

.zpanel-settings-modal .n-data-table-th {
  color: #334155;
  font-weight: 760;
}

.zpanel-settings-modal .n-tag {
  --n-border-radius: 10px !important;
}

.zpanel-settings-modal .text-slate-500 {
  color: var(--zpanel-muted) !important;
}

.dark .zpanel-settings-modal {
  --zpanel-text: #f8fafc;
  --zpanel-muted: #94a3b8;
  --zpanel-glass: rgba(15, 23, 42, 0.48);
  --zpanel-glass-strong: rgba(15, 23, 42, 0.66);
}

.dark .zpanel-settings-modal .n-card__content {
  background:
    radial-gradient(circle at 12% 0%, rgba(10, 132, 255, 0.14), transparent 28%),
    linear-gradient(135deg, rgba(15, 23, 42, 0.82), rgba(30, 41, 59, 0.62));
}

.dark .zpanel-settings-modal .n-data-table {
  background: rgba(15, 23, 42, 0.42);
  border-color: rgba(255, 255, 255, 0.1);
}
</style>
