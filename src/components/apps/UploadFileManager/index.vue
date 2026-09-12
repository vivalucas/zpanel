<script setup lang="ts">
import { NAlert, NButton, NButtonGroup, NCard, NEllipsis, NGrid, NGridItem, NImage, NImageGroup, NPagination, NSelect, NSwitch, NSpin, useDialog, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { deletes, getList, getPublicList } from '@/api/system/file'
import { set as savePanelConfig } from '@/api/panel/userConfig'
import { RoundCardModal, SvgIcon } from '@/components/common'
import { copyToClipboard, timeFormat } from '@/utils/cmn'
import { t } from '@/locales'
import { post } from '@/utils/request'
import { useAuthStore, usePanelState } from '@/store'

interface InfoModalState {
  title: string
  show: boolean
  fileInfo: File.Info | null
}
const imageList = ref<File.Info[]>([])
const ms = useMessage()
const dialog = useDialog()
const panelStore = usePanelState()
const authStore = useAuthStore()
const loading = ref(false)
const wallpaperDraft = ref<string | null>(null)
const wallpaperSaving = ref(false)
const usage = ref<Array<{ kind: string; title: string; id: string }>>([])
const usageLoading = ref(false)
const usageFailed = ref(false)
const replacementID = ref<number | null>(null)
const replacing = ref(false)
const publicGallery = ref(false)
const pagination = ref({
  page: 1,
  pageSize: 24,
  pageSizes: [24, 48, 96],
  itemCount: 0,
})
const infoModalState = ref<InfoModalState>({
  show: false,
  title: '',
  fileInfo: null,
})

async function getFileList(page: number | null = null) {
  loading.value = true
  try {
    const currentPage = page ?? pagination.value.page
    const req: Common.ListRequest = {
      page: currentPage,
      limit: pagination.value.pageSize,
    }
    const { data } = publicGallery.value
      ? await getPublicList<Common.ListResponse<File.Info[]>>(req)
      : await getList<Common.ListResponse<File.Info[]>>(req)
    pagination.value.page = currentPage
    pagination.value.itemCount = data.count
    imageList.value = data.list

    const maxPage = Math.max(1, Math.ceil((data.count || 0) / pagination.value.pageSize))
    if (pagination.value.page > maxPage) {
      pagination.value.page = maxPage
      await getFileList(maxPage)
    }
  }
  catch {
    ms.error(t('common.networkError'))
  }
  finally {
    loading.value = false
  }
}

async function copyImageUrl(text: string) {
  const res = await copyToClipboard(text)
  if (res)
    ms.success(t('apps.uploadsFileManager.copySuccess'))

  else
    ms.error(t('apps.uploadsFileManager.copyFailed'))
}

function handleDelete(id: number) {
  dialog.warning({
    title: t('common.warning'),
    content: t('apps.uploadsFileManager.deleteWarningText'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      deletesImges(id)
    },
  })
}

async function deletesImges(id: number) {
  try {
    const { code, data, msg } = await deletes<{ deletedIds?: number[]; failedIds?: number[] }>([id])
    if (code === 0) {
      await getFileList(pagination.value.page)
      if (data?.failedIds?.length) {
        const deletedCount = data.deletedIds?.length ?? 0
        ms.warning(`${t('common.success')}: ${deletedCount}, ${t('common.failed')}: ${data.failedIds.length}`)
      }
      else {
        ms.success(t('common.success'))
      }
    }
    else {
      ms.error(`${t('common.failed')}:${msg}`)
    }
  }
  catch {
    ms.error(t('common.failed'))
  }
}

async function handleInfoClick(fileInfo: File.Info) {
  usage.value = []
  usageFailed.value = false
  replacementID.value = null
  usageLoading.value = true
  infoModalState.value.fileInfo = fileInfo
  infoModalState.value.show = true
  try {
    const res = await post<Array<{ kind: string; title: string; id: string }>>({ url: '/file/usage', data: { id: fileInfo.id } })
    if (res.code === 0)
      usage.value = res.data
    else {
      usageFailed.value = true
      ms.error(res.msg)
    }
  }
  catch {
    usageFailed.value = true
  }
  finally {
    usageLoading.value = false
  }
}

async function replaceUsage() {
  if (!replacementID.value || !infoModalState.value.fileInfo?.id)
    return
  replacing.value = true
  try {
    const res = await post({ url: '/file/replace', data: { id: infoModalState.value.fileInfo.id, replacementId: replacementID.value } })
    if (res.code !== 0) { ms.error(res.msg); return }
    await panelStore.updatePanelConfigByCloud()
    ms.success(t('review.replaced'))
    await handleInfoClick(infoModalState.value.fileInfo)
  }
  finally {
    replacing.value = false
  }
}

async function handleSetWallpaper(imgSrc: string) {
  wallpaperDraft.value = imgSrc
  if (wallpaperSaving.value)
    return
  wallpaperSaving.value = true
  try {
    const panel = { ...panelStore.panelConfig, backgroundImageSrc: imgSrc }
    const { code, msg } = await savePanelConfig({ panel })
    if (code === 0) {
      panelStore.panelConfig = panel
      panelStore.recordState()
      if (wallpaperDraft.value === imgSrc)
        wallpaperDraft.value = null
      ms.success(t('apps.baseSettings.configSaved'))
    }
    else { ms.error(msg) }
  }
  catch {
    ms.error(t('review.unsaved'))
  }
  finally { wallpaperSaving.value = false }
}

function handlePageChange(page: number) {
  pagination.value.page = page
  getFileList(page)
}

function handlePageSizeChange(pageSize: number) {
  pagination.value.pageSize = pageSize
  pagination.value.page = 1
  getFileList(1)
}

function handleGalleryChange(value: boolean) {
  publicGallery.value = value
  pagination.value.page = 1
  getFileList(1)
}

onMounted(() => {
  getFileList()
})
</script>

<template>
  <div class="zpanel-settings-page">
    <NSpin v-show="loading" size="small" />
    <NAlert type="info" :bordered="false">
      {{ $t('apps.uploadsFileManager.alertText') }}
    </NAlert>
    <NAlert v-if="wallpaperDraft" type="warning" class="mt-2">
      {{ $t('review.unsaved') }}
      <NButton size="tiny" :loading="wallpaperSaving" @click="handleSetWallpaper(wallpaperDraft)">
        {{ $t('review.retry') }}
      </NButton>
      <NButton size="tiny" :disabled="wallpaperSaving" @click="wallpaperDraft = null">
        {{ $t('common.cancel') }}
      </NButton>
    </NAlert>
    <div class="mt-2 flex items-center">
      <span class="mr-2">{{ $t('apps.uploadsFileManager.publicGallery') }}</span>
      <NSwitch v-model:value="publicGallery" @update:value="handleGalleryChange" />
    </div>
    <div class="flex justify-center mt-2">
      <div v-if="imageList.length === 0 && !loading" class="flex">
        {{ $t('apps.uploadsFileManager.nothingText') }}
      </div>
      <NImageGroup v-else>
        <NGrid cols="2 300:2 600:4 900:6 1100:9" :x-gap="5" :y-gap="5">
          <NGridItem v-for="item in imageList" :key="item.id ?? item.src">
            <NCard size="small" :bordered="true">
              <template #cover>
                <div class="card transparent-grid">
                  <NImage :lazy="true" style="object-fit: contain;height: 100%;" :src="item.src" />
                </div>
              </template>
              <template #footer>
                <span class="text-xs">
                  <NEllipsis>
                    {{ item.fileName }}
                  </NEllipsis>
                </span>
                <div class="flex justify-center mt-[10px]">
                  <NButtonGroup>
                    <NButton size="tiny" style="cursor: pointer;" :title="$t('apps.uploadsFileManager.copyLink')" @click="copyImageUrl(item.src)">
                      <template #icon>
                        <SvgIcon icon="ion-copy" />
                      </template>
                    </NButton>
                    <NButton size="tiny" style="cursor: pointer;" :title="timeFormat(item.createTime)" @click="handleInfoClick(item)">
                      <template #icon>
                        <SvgIcon icon="mdi-information-box-outline" />
                      </template>
                    </NButton>
                    <NButton size="tiny" style="cursor: pointer;" :title="$t('apps.uploadsFileManager.setWallpaper')" @click="handleSetWallpaper(item.src)">
                      <template #icon>
                        <SvgIcon icon="lucide:wallpaper" />
                      </template>
                    </NButton>
                    <NButton v-if="item.ownerId === authStore.userInfo?.id" size="tiny" type="error" style="cursor: pointer;" :title="$t('common.delete')" @click="item.id !== undefined && handleDelete(item.id)">
                      <template #icon>
                        <SvgIcon icon="material-symbols-delete" />
                      </template>
                    </NButton>
                  </NButtonGroup>
                </div>
              </template>
            </NCard>
          </NGridItem>
        </NGrid>
      </NImageGroup>
    </div>

    <div v-if="pagination.itemCount > 0" class="mt-4 flex justify-center">
      <NPagination
        :page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="pagination.pageSizes"
        :item-count="pagination.itemCount"
        show-size-picker
        @update:page="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </div>

    <RoundCardModal v-model:show="infoModalState.show" class="zpanel-settings-modal" style="max-width: 420px;" size="small" :title="$t('apps.uploadsFileManager.infoTitle')">
      <NSpin :show="usageLoading">
        <p>{{ $t('review.usage') }}</p>
        <p v-if="usageFailed">
          {{ $t('common.failed') }}
        </p>
        <p v-if="!usage.length && !usageLoading && !usageFailed">
          {{ $t('review.unused') }}
        </p>
        <p v-for="(entry, index) in usage" :key="index">
          {{ $t(`review.usage_${entry.kind}`) }}: {{ entry.title || (entry.id ? `#${entry.id}` : $t('review.privateUsage')) }}
        </p>
        <div v-if="infoModalState.fileInfo?.ownerId === authStore.userInfo?.id">
          <p>{{ $t('review.replaceHelp') }}</p>
          <NSelect v-model:value="replacementID" :options="imageList.filter(item => item.id !== infoModalState.fileInfo?.id).map(item => ({ label: item.fileName, value: item.id }))" />
          <NButton class="mt-2" :disabled="!replacementID" :loading="replacing" @click="replaceUsage">
            {{ $t('review.replaceUsage') }}
          </NButton>
        </div>
      </NSpin>
      <div>
        <div>
          <div class="mb-2">
            <span class="text-slate-500">
              {{ $t('apps.uploadsFileManager.fileName') }}
            </span>
            <div class="text-xs">
              {{ infoModalState.fileInfo?.fileName }}
            </div>
          </div>
          <div class="mb-2">
            <span class="text-slate-500">
              {{ $t('apps.uploadsFileManager.path') }}
            </span>
            <div class="text-xs">
              {{ infoModalState.fileInfo?.src }}
            </div>
          </div>
          <div class="mb-2">
            <span class="text-slate-500">
              {{ $t('apps.uploadsFileManager.uploadTime') }}
            </span>
            <div class="text-xs">
              {{ timeFormat(infoModalState.fileInfo?.createTime) }}
            </div>
          </div>
        </div>
      </div>
    </RoundCardModal>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
}

.transparent-grid {
  background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%),
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
</style>
