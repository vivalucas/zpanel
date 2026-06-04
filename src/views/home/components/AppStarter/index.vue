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
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
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
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.app-starter-nav-button:hover {
  color: #0f172a;
  background: #fff;
  border-color: #cbd5e1;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
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
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  transition: opacity 0.3s ease;
}

:global(.dark) .app-starter-header {
  color: #f8fafc;
}

:global(.dark) .app-starter-toggle {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.16);
}

:global(.dark) .app-starter-nav {
  background: #111827;
  border-color: #334155;
}

:global(.dark) .app-starter-nav-button {
  color: #cbd5e1;
  background: #1f2937;
  border-color: #334155;
  box-shadow: none;
}

:global(.dark) .app-starter-nav-button:hover {
  color: #f8fafc;
  background: #273449;
  border-color: #475569;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
}

:global(.dark) .app-starter-nav-item.active .app-starter-nav-button {
  color: #93c5fd;
  background: rgba(37, 99, 235, 0.18);
  border-color: rgba(96, 165, 250, 0.36);
}

:global(.dark) .app-starter-content-inner {
  background: #0f172a;
  border-color: #334155;
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
  --zpanel-line: #e2e8f0;
  --zpanel-glass: #fff;
  --zpanel-glass-strong: #fff;
}

.dark .zpanel-settings-modal {
  --zpanel-blue: #60a5fa;
  --zpanel-blue-hover: #93c5fd;
  --zpanel-blue-pressed: #3b82f6;
  --zpanel-danger: #f87171;
  --zpanel-danger-hover: #fca5a5;
  --zpanel-danger-pressed: #ef4444;
  --zpanel-text: #e5e7eb;
  --zpanel-muted: #94a3b8;
  --zpanel-line: #334155;
  --zpanel-glass: #111827;
  --zpanel-glass-strong: #1f2937;
}

.zpanel-settings-modal .n-card__content {
  background: #f8fafc;
}

.dark .zpanel-settings-modal .n-card__content {
  background: #0f172a;
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
  --n-border-color: #e2e8f0 !important;
  --n-box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08) !important;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
}

.dark .zpanel-settings-modal .n-card {
  --n-border-color: var(--zpanel-line) !important;
  --n-box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22) !important;
  border-color: var(--zpanel-line);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.22);
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

.dark .zpanel-settings-modal .n-button--primary-type {
  --n-color: #2563eb !important;
  --n-color-hover: #1d4ed8 !important;
  --n-color-pressed: #1e40af !important;
  --n-color-focus: #1d4ed8 !important;
  --n-border: 1px solid rgba(96, 165, 250, 0.32) !important;
  --n-border-hover: 1px solid rgba(147, 197, 253, 0.42) !important;
  --n-border-pressed: 1px solid rgba(147, 197, 253, 0.34) !important;
  --n-border-focus: 1px solid rgba(147, 197, 253, 0.42) !important;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.26);
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
  --n-color-hover: #fff !important;
  --n-color-pressed: #f1f5f9 !important;
  --n-color-focus: #fff !important;
  --n-border: 1px solid #cbd5e1 !important;
  --n-border-hover: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-border-pressed: 1px solid rgba(0, 122, 255, 0.34) !important;
  --n-border-focus: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-text-color: #334155 !important;
  --n-text-color-hover: var(--zpanel-blue) !important;
  --n-text-color-pressed: var(--zpanel-blue-pressed) !important;
  --n-text-color-focus: var(--zpanel-blue) !important;
  box-shadow: none;
}

.dark .zpanel-settings-modal .n-button--warning-type,
.dark .zpanel-settings-modal .n-button--success-type,
.dark .zpanel-settings-modal .n-button--info-type,
.dark .zpanel-settings-modal .n-button--default-type {
  --n-color: #1f2937 !important;
  --n-color-hover: #273449 !important;
  --n-color-pressed: #111827 !important;
  --n-color-focus: #273449 !important;
  --n-border: 1px solid #475569 !important;
  --n-border-hover: 1px solid rgba(96, 165, 250, 0.46) !important;
  --n-border-pressed: 1px solid rgba(96, 165, 250, 0.38) !important;
  --n-border-focus: 1px solid rgba(96, 165, 250, 0.46) !important;
  --n-text-color: #cbd5e1 !important;
  --n-text-color-hover: #93c5fd !important;
  --n-text-color-pressed: #60a5fa !important;
  --n-text-color-focus: #93c5fd !important;
}

.zpanel-settings-modal .n-input,
.zpanel-settings-modal .n-input-number,
.zpanel-settings-modal .n-base-selection {
  --n-border-radius: 12px !important;
  --n-color: #fff !important;
  --n-color-focus: #fff !important;
  --n-border: 1px solid #cbd5e1 !important;
  --n-border-hover: 1px solid rgba(0, 122, 255, 0.28) !important;
  --n-border-focus: 1px solid rgba(0, 122, 255, 0.42) !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(0, 122, 255, 0.12) !important;
}

.dark .zpanel-settings-modal .n-input,
.dark .zpanel-settings-modal .n-input-number,
.dark .zpanel-settings-modal .n-base-selection {
  --n-color: #111827 !important;
  --n-color-focus: #111827 !important;
  --n-border: 1px solid #475569 !important;
  --n-border-hover: 1px solid rgba(96, 165, 250, 0.5) !important;
  --n-border-focus: 1px solid rgba(96, 165, 250, 0.72) !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(96, 165, 250, 0.16) !important;
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

.dark .zpanel-settings-modal .n-alert {
  background: rgba(59, 130, 246, 0.14) !important;
  border-color: rgba(96, 165, 250, 0.24) !important;
}

.zpanel-settings-modal .n-data-table {
  --n-border-radius: 16px !important;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.dark .zpanel-settings-modal .n-data-table {
  background: #111827;
  border-color: var(--zpanel-line);
}

.zpanel-settings-modal .n-data-table-th,
.zpanel-settings-modal .n-data-table-td {
  background: #fff !important;
  border-color: #e2e8f0 !important;
}

.dark .zpanel-settings-modal .n-data-table-th,
.dark .zpanel-settings-modal .n-data-table-td {
  color: #e5e7eb !important;
  background: #111827 !important;
  border-color: var(--zpanel-line) !important;
}

.zpanel-settings-modal .n-data-table-th {
  color: #334155;
  font-weight: 760;
  background: #f8fafc !important;
}

.dark .zpanel-settings-modal .n-data-table-th {
  color: #cbd5e1 !important;
  background: #1f2937 !important;
}

.zpanel-settings-modal .n-tag {
  --n-border-radius: 10px !important;
}

.zpanel-settings-modal .text-slate-500 {
  color: var(--zpanel-muted) !important;
}
</style>
