<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { NBackTop, NButton, NButtonGroup, NDropdown, NModal, NSkeleton, NSpin, useDialog, useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, ref } from 'vue'
import { AppIcon, AppStarter, EditItem } from './components'
import { Clock, SearchBox, SystemMonitor } from '@/components/deskModule'
import { SvgIcon } from '@/components/common'
import { deletes, getListByGroupId, saveSort } from '@/api/panel/itemIcon'
import { getList as getGroupList } from '@/api/panel/itemIconGroup'

import { openExternalUrl, setTitle, updateLocalUserInfo } from '@/utils/cmn'
import { useAuthStore, usePanelState } from '@/store'
import { PanelPanelConfigStyleEnum, PanelStateNetworkModeEnum } from '@/enums'
import { VisitMode } from '@/enums/auth'
import { router } from '@/router'
import { t } from '@/locales'

interface ItemGroup extends Panel.ItemIconGroup {
  sortStatus?: boolean
  hoverStatus: boolean
  items?: Panel.ItemInfo[]
}

const ms = useMessage()
const dialog = useDialog()
const panelState = usePanelState()
const authStore = useAuthStore()

const scrollContainerRef = ref<HTMLElement | undefined>(undefined)

const editItemInfoShow = ref<boolean>(false)
const editItemInfoData = ref<Panel.ItemInfo | null>(null)
const windowShow = ref<boolean>(false)
const windowSrc = ref<string>('')
const windowTitle = ref<string>('')

const windowIframeIsLoad = ref<boolean>(false)

const dropdownMenuX = ref(0)
const dropdownMenuY = ref(0)
const dropdownShow = ref(false)
const currentRightSelectItem = ref<Panel.ItemInfo | null>(null)
const currentAddItenIconGroupId = ref<number | undefined>()

const settingModalShow = ref(false)

const items = ref<ItemGroup[]>([])
const filterItems = ref<ItemGroup[]>([])
const panelFooterHtml = computed(() => panelState.panelConfig.footerHtml || '')
const homeBackgroundStyle = computed(() => {
  const backgroundImageSrc = panelState.panelConfig.backgroundImageSrc || ''
  const isLegacyDefault = backgroundImageSrc.includes('defaultBackground')

  return {
    filter: `blur(${panelState.panelConfig.backgroundBlur}px)`,
    background: backgroundImageSrc && !isLegacyDefault
      ? `url(${backgroundImageSrc}) center / cover no-repeat`
      : 'radial-gradient(circle at 16% 10%, rgba(90, 200, 250, 0.22), transparent 30%), radial-gradient(circle at 86% 18%, rgba(0, 122, 255, 0.16), transparent 26%), linear-gradient(135deg, #eef4ff 0%, #f8fbff 46%, #e9f1ff 100%)',
  }
})

function backTopListenTarget() {
  return scrollContainerRef.value || document
}

function openPage(openMethod: number, url: string, title?: string) {
  switch (openMethod) {
    case 1:
      window.location.href = url
      break
    case 2:
      openExternalUrl(url)
      break
    case 3:
      windowShow.value = true
      windowSrc.value = url
      windowTitle.value = title || url
      windowIframeIsLoad.value = true
      break

    default:
      break
  }
}

function handleItemClick(itemGroupIndex: number, item: Panel.ItemInfo) {
  if (items.value[itemGroupIndex] && items.value[itemGroupIndex].sortStatus) {
    handleEditItem(item)
    return
  }

  const jumpUrl = panelState.networkMode === PanelStateNetworkModeEnum.lan
    ? item.lanUrl || item.url
    : item.url || item.lanUrl
  if (!jumpUrl)
    return

  openPage(item.openMethod, jumpUrl, item.title)
}

function handWindowIframeIdLoad() {
  windowIframeIsLoad.value = false
}

function getList() {
  // 获取组数据
  getGroupList<Common.ListResponse<ItemGroup[]>>().then(({ code, data }) => {
    if (code !== 0)
      return
    items.value = data.list
    for (let i = 0; i < data.list.length; i++) {
      const element = data.list[i]
      if (element.id)
        updateItemIconGroupByNet(i, element.id)
    }
    filterItems.value = items.value
  }).catch(() => {})
}

// 从后端获取组下面的图标
function updateItemIconGroupByNet(itemIconGroupIndex: number, itemIconGroupId: number) {
  getListByGroupId<Common.ListResponse<Panel.ItemInfo[]>>(itemIconGroupId).then((res) => {
    if (res.code === 0 && items.value[itemIconGroupIndex])
      items.value[itemIconGroupIndex].items = res.data.list
  })
}

function handleRightMenuSelect(key: string | number) {
  dropdownShow.value = false
  // console.log(currentRightSelectItem, key)
  let jumpUrl = panelState.networkMode === PanelStateNetworkModeEnum.lan ? currentRightSelectItem.value?.lanUrl : currentRightSelectItem.value?.url
  if (currentRightSelectItem.value?.lanUrl === '')
    jumpUrl = currentRightSelectItem.value.url
  switch (key) {
    case 'newWindows':
      if (jumpUrl)
        openExternalUrl(jumpUrl)
      break
    case 'openWanUrl':
      if (currentRightSelectItem.value)
        openPage(currentRightSelectItem.value?.openMethod, currentRightSelectItem.value?.url, currentRightSelectItem.value?.title)
      break
    case 'openLanUrl':
      if (currentRightSelectItem.value && currentRightSelectItem.value.lanUrl)
        openPage(currentRightSelectItem.value?.openMethod, currentRightSelectItem.value.lanUrl, currentRightSelectItem.value?.title)
      break
    case 'edit':
      // 这里有个奇怪的问题，如果不使用{...}的方式 父组件的值会同步修改 标记一下
      if (currentRightSelectItem.value)
        handleEditItem({ ...currentRightSelectItem.value })
      break
    case 'delete':
      dialog.warning({
        title: t('common.warning'),
        content: t('common.deleteConfirmByName', { name: currentRightSelectItem.value?.title }),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        onPositiveClick: () => {
          if (!currentRightSelectItem.value?.id)
            return
          deletes([currentRightSelectItem.value.id]).then(({ code, msg }) => {
            if (code === 0) {
              ms.success(t('common.deleteSuccess'))
              getList()
            }
            else {
              ms.error(`${t('common.deleteFail')}:${msg}`)
            }
          })
        },
      })

      break
    default:
      break
  }
}

function handleContextMenu(e: MouseEvent, itemGroupIndex: number, item: Panel.ItemInfo) {
  if (items.value[itemGroupIndex] && items.value[itemGroupIndex].sortStatus)
    return

  e.preventDefault()
  currentRightSelectItem.value = item
  dropdownShow.value = false
  nextTick().then(() => {
    dropdownShow.value = true
    dropdownMenuX.value = e.clientX
    dropdownMenuY.value = e.clientY
  })
}

function onClickoutside() {
  // message.info('clickoutside')
  dropdownShow.value = false
}

function handleEditSuccess() {
  getList()
}

function handleChangeNetwork(mode: PanelStateNetworkModeEnum) {
  panelState.setNetworkMode(mode)
  if (mode === PanelStateNetworkModeEnum.lan)
    ms.success(t('panelHome.changeToLanModelSuccess'))

  else
    ms.success(t('panelHome.changeToWanModelSuccess'))
}

// 结束拖拽
// function handleEndDrag(event: any, itemIconGroup: Panel.ItemIconGroup) {
//   // console.log(event)
//   // console.log(items.value)
// }

function handleSaveSort(itemGroup: ItemGroup) {
  if (!itemGroup.items || typeof itemGroup.id !== 'number')
    return

  const saveItems: Common.SortItemRequest[] = []
  for (let i = 0; i < itemGroup.items.length; i++) {
    const element = itemGroup.items[i]
    if (typeof element.id !== 'number')
      return

    saveItems.push({
      id: element.id,
      sort: i + 1,
    })
  }

  saveSort({ itemIconGroupId: itemGroup.id, sortItems: saveItems }).then(({ code, msg }) => {
    if (code === 0) {
      ms.success(t('common.saveSuccess'))
      itemGroup.sortStatus = false
    }
    else {
      ms.error(`${t('common.saveFail')}:${msg}`)
    }
  })
}

const dropdownMenuOptions = computed(() => {
  const options = [
    {
      label: t('iconItem.newWindowOpen'),
      key: 'newWindows',
    },

  ]

  if (currentRightSelectItem.value?.lanUrl && panelState.networkMode === PanelStateNetworkModeEnum.wan) {
    options.push({
      label: t('panelHome.openLanUrl'),
      key: 'openLanUrl',
    })
  }

  if (currentRightSelectItem.value?.lanUrl && panelState.networkMode === PanelStateNetworkModeEnum.lan) {
    options.push({
      label: t('panelHome.openWanUrl'),
      key: 'openWanUrl',
    })
  }

  if (authStore.visitMode === VisitMode.VISIT_MODE_LOGIN) {
    options.push({
      label: t('common.edit'),
      key: 'edit',
    }, {
      label: t('common.delete'),
      key: 'delete',
    })
  }
  return options
})

onMounted(async () => {
  // 更新用户信息
  await updateLocalUserInfo()
  getList()

  // 更新同步云端配置
  await panelState.updatePanelConfigByCloud()

  // 设置标题
  if (panelState.panelConfig.logoText)
    setTitle(panelState.panelConfig.logoText)
})

// 前端搜索过滤
function itemFrontEndSearch(keyword?: string) {
  keyword = keyword?.trim()
  if (keyword !== '' && panelState.panelConfig.searchBoxSearchIcon) {
    const filteredData = ref<ItemGroup[]>([])
    for (let i = 0; i < items.value.length; i++) {
      const element = items.value[i].items?.filter((item: Panel.ItemInfo) => {
        return (
          item.title.toLowerCase().includes(keyword?.toLowerCase() ?? '')
          || item.url.toLowerCase().includes(keyword?.toLowerCase() ?? '')
          || item.description?.toLowerCase().includes(keyword?.toLowerCase() ?? '')
        )
      })
      if (element && element.length > 0)
        filteredData.value.push({ items: element, hoverStatus: false })
    }
    filterItems.value = filteredData.value
  }
  else {
    filterItems.value = items.value
  }
}

function handleSetHoverStatus(groupIndex: number, hoverStatus: boolean) {
  if (items.value[groupIndex])
    items.value[groupIndex].hoverStatus = hoverStatus
}

function handleSetSortStatus(groupIndex: number, sortStatus: boolean) {
  if (items.value[groupIndex])
    items.value[groupIndex].sortStatus = sortStatus

  // 并未保存排序重新更新数据
  if (!sortStatus) {
    // 单独更新组
    const itemGroupId = items.value[groupIndex]?.id
    if (typeof itemGroupId === 'number')
      updateItemIconGroupByNet(groupIndex, itemGroupId)
  }
}

function handleEditItem(item: Panel.ItemInfo) {
  editItemInfoData.value = item
  editItemInfoShow.value = true
  currentAddItenIconGroupId.value = undefined
}

function handleAddItem(itemIconGroupId?: number) {
  editItemInfoData.value = null
  editItemInfoShow.value = true
  if (itemIconGroupId)
    currentAddItenIconGroupId.value = itemIconGroupId
}
</script>

<template>
  <div class="w-full h-full sun-main">
    <div
      class="cover wallpaper" :style="homeBackgroundStyle"
    />
    <div class="mask" :style="{ backgroundColor: `rgba(255,255,255,${Math.min(panelState.panelConfig.backgroundMaskNumber ?? 0, 0.16)})` }" />
    <div ref="scrollContainerRef" class="absolute w-full h-full overflow-auto">
      <div
        class="p-2.5 mx-auto"
        :style="{
          marginTop: `${panelState.panelConfig.marginTop}%`,
          marginBottom: `${panelState.panelConfig.marginBottom}%`,
          maxWidth: (panelState.panelConfig.maxWidth ?? '1200') + panelState.panelConfig.maxWidthUnit,
        }"
      >
        <!-- 头 -->
        <div class="mx-[auto] w-[80%]">
          <div class="home-hero flex mx-[auto] items-center justify-center">
            <div class="logo">
              <span class="text-2xl md:text-6xl font-bold">
                {{ panelState.panelConfig.logoText }}
              </span>
            </div>
            <div class="divider text-base lg:text-2xl mx-[10px]">
              |
            </div>
            <div>
              <Clock :hide-second="!panelState.panelConfig.clockShowSecond" />
            </div>
          </div>
          <div v-if="panelState.panelConfig.searchBoxShow" class="flex mt-[20px] mx-auto sm:w-full lg:w-[80%]">
            <SearchBox @item-search="itemFrontEndSearch" />
          </div>
        </div>

        <!-- 应用盒子 -->
        <div :style="{ marginLeft: `${panelState.panelConfig.marginX}px`, marginRight: `${panelState.panelConfig.marginX}px` }">
          <!-- 系统监控状态 -->
          <div
            v-if="panelState.panelConfig.systemMonitorShow
              && ((panelState.panelConfig.systemMonitorPublicVisitModeShow && authStore.visitMode === VisitMode.VISIT_MODE_PUBLIC)
                || authStore.visitMode === VisitMode.VISIT_MODE_LOGIN)"
            class="flex mx-auto"
          >
            <SystemMonitor
              :allow-edit="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN"
              :show-title="panelState.panelConfig.systemMonitorShowTitle"
            />
          </div>

          <!-- 组纵向排列 -->
          <div
            v-for="(itemGroup, itemGroupIndex) in filterItems" :key="itemGroup.id ?? `filter-${itemGroupIndex}`"
            class="item-list mt-[50px]"
            :class="itemGroup.sortStatus ? 'item-list-sorting' : ''"
            @mouseenter="handleSetHoverStatus(itemGroupIndex, true)"
            @mouseleave="handleSetHoverStatus(itemGroupIndex, false)"
          >
            <!-- 分组标题 -->
            <div class="group-heading text-xl font-extrabold mb-[20px] ml-[10px] flex items-center">
              <span class="group-title">
                {{ itemGroup.title }}
              </span>
              <div
                v-if="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN"
                class="group-buttons ml-2 delay-100 transition-opacity flex"
                :class="itemGroup.hoverStatus ? 'opacity-100' : 'opacity-0'"
              >
                <span class="mr-2 cursor-pointer" :title="t('common.add')" @click="handleAddItem(itemGroup.id)">
                  <SvgIcon class="text-white font-xl" icon="typcn:plus" />
                </span>
                <span class="mr-2 cursor-pointer " :title="t('common.sort')" @click="handleSetSortStatus(itemGroupIndex, !itemGroup.sortStatus)">
                  <SvgIcon class="text-white font-xl" icon="ri:drag-drop-line" />
                </span>
              </div>
            </div>

            <!-- 详情图标 -->
            <div v-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.info">
              <div v-if="itemGroup.items">
                <VueDraggable
                  v-model="itemGroup.items" item-key="id" :animation="300"
                  class="icon-info-box"
                  filter=".not-drag"
                  :disabled="!itemGroup.sortStatus"
                >
                  <div v-for="item, index in itemGroup.items" :key="item.id ?? index" :title="item.description" @contextmenu="(e) => handleContextMenu(e, itemGroupIndex, item)">
                    <AppIcon
                      :class="itemGroup.sortStatus ? 'cursor-move' : 'cursor-pointer'"
                      :item-info="item"
                      :icon-text-color="panelState.panelConfig.iconTextColor"
                      :icon-text-info-hide-description="panelState.panelConfig.iconTextInfoHideDescription || false"
                      :icon-text-icon-hide-title="panelState.panelConfig.iconTextIconHideTitle || false"
                      :style="0"
                      @click="handleItemClick(itemGroupIndex, item)"
                    />
                  </div>

                  <div v-if="itemGroup.items.length === 0" class="not-drag">
                    <AppIcon
                      :class="itemGroup.sortStatus ? 'cursor-move' : 'cursor-pointer'"
                      :item-info="{ icon: { itemType: 3, text: 'subway:add' }, title: t('common.add'), url: '', openMethod: 0 }"
                      :icon-text-color="panelState.panelConfig.iconTextColor"
                      :icon-text-info-hide-description="panelState.panelConfig.iconTextInfoHideDescription || false"
                      :icon-text-icon-hide-title="panelState.panelConfig.iconTextIconHideTitle || false"
                      :style="0"
                      @click="handleAddItem(itemGroup.id)"
                    />
                  </div>
                </VueDraggable>
              </div>
            </div>

            <!-- APP图标宫型盒子 -->
            <div v-if="panelState.panelConfig.iconStyle === PanelPanelConfigStyleEnum.icon">
              <div v-if="itemGroup.items">
                <VueDraggable
                  v-model="itemGroup.items" item-key="id" :animation="300"
                  class="icon-small-box"

                  filter=".not-drag"
                  :disabled="!itemGroup.sortStatus"
                >
                  <div v-for="item, index in itemGroup.items" :key="item.id ?? index" :title="item.description" @contextmenu="(e) => handleContextMenu(e, itemGroupIndex, item)">
                    <AppIcon
                      :class="itemGroup.sortStatus ? 'cursor-move' : 'cursor-pointer'"
                      :item-info="item"
                      :icon-text-color="panelState.panelConfig.iconTextColor"
                      :icon-text-info-hide-description="!panelState.panelConfig.iconTextInfoHideDescription"
                      :icon-text-icon-hide-title="panelState.panelConfig.iconTextIconHideTitle || false"
                      :style="1"
                      @click="handleItemClick(itemGroupIndex, item)"
                    />
                  </div>

                  <div v-if="itemGroup.items.length === 0" class="not-drag">
                    <AppIcon
                      class="cursor-pointer"
                      :item-info="{ icon: { itemType: 3, text: 'subway:add' }, title: $t('common.add'), url: '', openMethod: 0 }"
                      :icon-text-color="panelState.panelConfig.iconTextColor"
                      :icon-text-info-hide-description="!panelState.panelConfig.iconTextInfoHideDescription"
                      :icon-text-icon-hide-title="panelState.panelConfig.iconTextIconHideTitle || false"
                      :style="1"
                      @click="handleAddItem(itemGroup.id)"
                    />
                  </div>
                </VueDraggable>
              </div>
            </div>

            <!-- 编辑栏 -->
            <div v-if="itemGroup.sortStatus" class="flex mt-[10px]">
              <div>
                <NButton color="#2a2a2a6b" @click="handleSaveSort(itemGroup)">
                  <template #icon>
                    <SvgIcon class="text-white font-xl" icon="material-symbols:save" />
                  </template>
                  <div>
                    {{ $t('common.saveSort') }}
                  </div>
                </NButton>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 footer" v-html="panelFooterHtml" />
      </div>
    </div>

    <!-- 右键菜单 -->
    <NDropdown
      placement="bottom-start" trigger="manual" :x="dropdownMenuX" :y="dropdownMenuY"
      :options="dropdownMenuOptions" :show="dropdownShow" :on-clickoutside="onClickoutside" @select="handleRightMenuSelect"
    />

    <!-- 悬浮按钮 -->
    <div class="fixed-element floating-tools">
      <NButtonGroup vertical>
        <!-- 网络模式切换按钮组 -->
        <NButton
          v-if="panelState.networkMode === PanelStateNetworkModeEnum.lan && panelState.panelConfig.netModeChangeButtonShow" quaternary
          :title="t('panelHome.changeToWanModel')" @click="handleChangeNetwork(PanelStateNetworkModeEnum.wan)"
        >
          <template #icon>
            <SvgIcon class="text-white font-xl" icon="material-symbols:lan-outline-rounded" />
          </template>
        </NButton>

        <NButton
          v-if="panelState.networkMode === PanelStateNetworkModeEnum.wan && panelState.panelConfig.netModeChangeButtonShow" quaternary
          :title="t('panelHome.changeToLanModel')" @click="handleChangeNetwork(PanelStateNetworkModeEnum.lan)"
        >
          <template #icon>
            <SvgIcon class="text-white font-xl" icon="mdi:wan" />
          </template>
        </NButton>

        <NButton v-if="authStore.visitMode === VisitMode.VISIT_MODE_LOGIN" quaternary @click="settingModalShow = !settingModalShow">
          <template #icon>
            <SvgIcon class="text-white font-xl" icon="majesticons-applications" />
          </template>
        </NButton>

        <NButton v-if="authStore.visitMode === VisitMode.VISIT_MODE_PUBLIC" quaternary :title="$t('panelHome.goToLogin')" @click="router.push('/login')">
          <template #icon>
            <SvgIcon class="text-white font-xl" icon="material-symbols:account-circle" />
          </template>
        </NButton>
      </NButtonGroup>

      <AppStarter v-model:visible="settingModalShow" />
      <!-- <Setting v-model:visible="settingModalShow" /> -->
    </div>

    <NBackTop
      :listen-to="backTopListenTarget"
      :right="10"
      :bottom="10"
      style="background-color:transparent;border: none;box-shadow: none;"
    >
      <div class="floating-tools">
        <NButton quaternary>
          <template #icon>
            <SvgIcon class="text-white font-xl" icon="icon-park-outline:to-top" />
          </template>
        </NButton>
      </div>
    </NBackTop>

    <EditItem v-model:visible="editItemInfoShow" :item-info="editItemInfoData" :item-group-id="currentAddItenIconGroupId" @done="handleEditSuccess" />

    <!-- 弹窗 -->
    <NModal
      v-model:show="windowShow" :mask-closable="false" preset="card"
      style="max-width: 1000px;height: 600px;border-radius: 1rem;" :bordered="true" size="small" role="dialog"
      aria-modal="true"
    >
      <template #header>
        <div class="flex items-center">
          <span class="mr-[20px]">
            {{ windowTitle }}
          </span>

          <NSpin v-if="windowIframeIsLoad" size="small" />
        </div>
      </template>
      <div class="w-full h-full rounded-2xl overflow-hidden border dark:border-zinc-700">
        <div v-if="windowIframeIsLoad" class="flex flex-col p-5">
          <NSkeleton height="50px" width="100%" class="rounded-lg" />
          <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
          <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
        </div>
        <iframe
          v-show="!windowIframeIsLoad" id="windowIframeId" :src="windowSrc"
          class="w-full h-full" frameborder="0" @load="handWindowIframeIdLoad"
        />
      </div>
    </NModal>
  </div>
</template>

<style>
body,
html {
  overflow: hidden;
  background-color: #eef4ff;
}
</style>

<style scoped>
.mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.sun-main {
  user-select: none;
}

.cover {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform: scale(1.05);
}

.fixed-element {
  position: fixed;
  /* 将元素固定在屏幕上 */
  right: 10px;
  /* 距离屏幕顶部的距离 */
  bottom: 50px;
  /* 距离屏幕左侧的距离 */
}

.wallpaper::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.42) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.42) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), transparent 72%);
}

.home-hero {
  color: #111827;
}

.home-hero .divider {
  color: #94a3b8;
}

.group-heading {
  color: #1f2937;
}

.group-buttons :deep(svg) {
  color: #475569;
}

.item-list-sorting {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.42);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px) saturate(1.25);
}

.floating-tools {
  overflow: hidden;
  color: #334155;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 14px;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(18px) saturate(1.25);
}

.floating-tools :deep(.n-button) {
  color: #334155;
}

.floating-tools :deep(.n-button__content svg) {
  color: #334155;
}

.footer {
  font-size: 13px;
  color: #64748b;
  text-align: center;
}

.footer :deep(a) {
  margin-left: 4px;
  font-weight: 600;
  color: #475569;
  text-decoration: none;
}

.footer :deep(a:hover) {
  color: #007aff;
}

.icon-info-box {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 18px;

}

.icon-small-box {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(75px, 1fr));
  gap: 18px;

}

@media (max-width: 500px) {
  .icon-info-box{
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
