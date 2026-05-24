<script setup lang="ts">
import { NAlert, NButton, NButtonGroup, NCard, NEllipsis, NGrid, NGridItem, NImage, NImageGroup, NPagination, NSwitch, NSpin, useDialog, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { deletes, getList, getPublicList } from '@/api/system/file'
import { set as savePanelConfig } from '@/api/panel/userConfig'
import { RoundCardModal, SvgIcon } from '@/components/common'
import { copyToClipboard, timeFormat } from '@/utils/cmn'
import { t } from '@/locales'
import { usePanelState } from '@/store'

interface InfoModalState {
  title: string
  show: boolean
  fileInfo: File.Info | null
}
const imageList = ref<File.Info[]>([])
const ms = useMessage()
const dialog = useDialog()
const panelStore = usePanelState()
const loading = ref(false)
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

function handleInfoClick(fileInfo: File.Info) {
  infoModalState.value.fileInfo = fileInfo
  infoModalState.value.show = true
}

async function handleSetWallpaper(imgSrc: string) {
  try {
    panelStore.panelConfig.backgroundImageSrc = imgSrc
    const { code, msg } = await savePanelConfig({ panel: panelStore.panelConfig })
    if (code === 0)
      ms.success(t('apps.baseSettings.configSaved'))
    else
      ms.error(`${t('common.failed')}: ${msg}`)
  }
  catch {
    ms.error(t('common.serverError'))
  }
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
  <div class="bg-slate-200 dark:bg-zinc-900 p-2 h-full">
    <NSpin v-show="loading" size="small" />
    <NAlert type="info" :bordered="false">
      {{ $t('apps.uploadsFileManager.alertText') }}
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
            <NCard size="small" style="border-radius: 5px;" :bordered="true">
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
                    <NButton size="tiny" tertiary style="cursor: pointer;" :title="$t('apps.uploadsFileManager.copyLink')" @click="copyImageUrl(item.src)">
                      <template #icon>
                        <SvgIcon icon="ion-copy" />
                      </template>
                    </NButton>
                    <NButton size="tiny" tertiary style="cursor: pointer;" :title="timeFormat(item.createTime)" @click="handleInfoClick(item)">
                      <template #icon>
                        <SvgIcon icon="mdi-information-box-outline" />
                      </template>
                    </NButton>
                    <NButton size="tiny" tertiary style="cursor: pointer;" :title="$t('apps.uploadsFileManager.setWallpaper')" @click="handleSetWallpaper(item.src)">
                      <template #icon>
                        <SvgIcon icon="lucide:wallpaper" />
                      </template>
                    </NButton>
                    <NButton size="tiny" tertiary type="error" style="cursor: pointer;" :title="$t('common.delete')" @click="item.id !== undefined && handleDelete(item.id)">
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

    <RoundCardModal v-model:show="infoModalState.show" style="max-width: 300px;" size="small" :title="$t('apps.uploadsFileManager.infoTitle')">
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
