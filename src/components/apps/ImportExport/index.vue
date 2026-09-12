<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { NAlert, NButton, NCheckbox, NCheckboxGroup, NDivider, NRadioButton, NRadioGroup, NSpace, NUpload, useMessage } from 'naive-ui'
import { RoundCardModal, SvgIcon } from '@/components/common'
import type { IconGroup, ImportJsonResult } from '@/utils/jsonImportExport'
import { ConfigVersionLowError, FormatError, collectIconGroups, exportJson, importJsonString } from '@/utils/jsonImportExport'
import { get as getAbout } from '@/api/system/about'
import { getList as getGroupList } from '@/api/panel/itemIconGroup'
import { getListByGroupId } from '@/api/panel/itemIcon'
import { post } from '@/utils/request'
import { randomCode } from '@/utils/cmn'
import { usePanelState } from '@/store'

import { t } from '@/locales'

interface ItemGroup extends Panel.ItemIconGroup {
  items?: Panel.ItemInfo[]
}

const ms = useMessage()
const panelState = usePanelState()

const jsonData = ref<string | null>(null)
const importWarning = ref<string[]>([])
const importRoundModalShow = ref(false)
const exportRoundModalShow = ref(false)
const loading = ref(false)
const uploadLoading = ref(false)
const version = ref('')

const importObj = ref<ImportJsonResult | null> (null)

const importItems = ref<string[]>(['icons', 'style'])
const checkedItems = ref<string[]>(['icons', 'style'])

const importMode = ref('append')
const importRequestId = ref('')
const importAttempted = ref(false)
const existingTitles = ref<string[]>([])
const importGroups = computed(() => importObj.value?.geticons() || [])
const importCount = computed(() => importGroups.value.reduce((count, group) => count + group.children.length, 0))
const conflictCount = computed(() => importGroups.value.filter(group => existingTitles.value.includes(group.title)).length)

async function exportIcons(): Promise<IconGroup[]> {
  return collectIconGroups(
    () => getGroupList<Common.ListResponse<ItemGroup[]>>(),
    id => getListByGroupId<Common.ListResponse<Panel.ItemInfo[]>>(id),
  )
}

onMounted(() => {
  interface Version {
    versionName: string
    versionCode: number
  }

  getAbout<Version>().then((res) => {
    if (res.code === 0)
      version.value = res.data.versionName
  })
})

function handleFileChange(options: { file: UploadFileInfo; fileList: Array<UploadFileInfo> }) {
  uploadLoading.value = true
  if (options.file.file) {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        jsonData.value = reader.result as string
        importCheck()
      }
      else {
        ms.error(`${t('common.failed')}: ${t('common.repeatLater')}`)
      }
      uploadLoading.value = false
    }
    reader.onerror = () => {
      uploadLoading.value = false
      ms.error(`${t('common.failed')}: ${t('common.repeatLater')}`)
    }
    if (options.file.file.size > 5 * 1024 * 1024) {
      uploadLoading.value = false
      ms.error(t('review.importSize'))
      return
    }
    reader.readAsText(options.file.file)
    return
  }
  uploadLoading.value = false
}

function importCheck() {
  importWarning.value = []
  if (jsonData.value) {
    try {
      importObj.value = importJsonString(jsonData.value)
      if (importObj.value) {
        if (!importObj.value.isPassCheckMd5())
          importWarning.value.push(t('apps.exportImport.fileModified'))

        if (!importObj.value.isPassCheckConfigVersionOld())
          importWarning.value.push(t('apps.exportImport.warnConfigFileLow'))

        if (!importObj.value.isPassCheckConfigVersionNew())
          importWarning.value.push(t('apps.exportImport.softwareVersionLow'))

        importItems.value = ['icons', 'style'].filter(key => importObj.value?.hasProperty(key === 'style' ? 'styleConfig' : key))
        checkedItems.value = [...importItems.value]
        importRequestId.value = randomCode(32)
        importAttempted.value = false
        importMode.value = 'append'
        existingTitles.value = []
        getGroupList<Common.ListResponse<ItemGroup[]>>().then((res) => {
          if (res.code === 0)
            existingTitles.value = res.data.list.map(group => group.title || '')
        }).catch(() => {})
        importRoundModalShow.value = true
      }
    }
    catch (error) {
      if (error instanceof ConfigVersionLowError) {
        ms.error(t('apps.exportImport.errorConfigFileLow'))
      }
      else if (error instanceof FormatError) {
        ms.error(t('apps.exportImport.errorConfigFileFormat'))
      }
    }
  }
  else {
    ms.error(t('apps.exportImport.errorConfigFileFormat'))
  }
}

async function handleStartExport() {
  loading.value = true
  try {
    const exportResult = exportJson(version.value)
    if (checkedItems.value.includes('icons')) {
      const iconGroups = await exportIcons()
      exportResult.addIconsData(iconGroups)
    }
    if (checkedItems.value.includes('style'))
      exportResult.addStyleData(panelState.panelConfig)

    jsonData.value = exportResult.string()
    exportResult.exportFile()
    exportRoundModalShow.value = false
    ms.success(t('common.success'))
  }
  catch {
    ms.error(t('common.serverError'))
  }
  finally {
    loading.value = false
  }
}

async function handleStartImport() {
  loading.value = true
  importAttempted.value = true
  try {
    const res = await post({
      url: '/panel/userConfig/import',
      data: {
        requestId: importRequestId.value,
        mode: importMode.value,
        ...(checkedItems.value.includes('icons') ? { icons: importGroups.value } : {}),
        ...(checkedItems.value.includes('style') ? { panel: importObj.value?.getStyleConfig() } : {}),
      },
    })
    if (res.code !== 0) {
      ms.error(res.msg)
      return
    }
    await panelState.updatePanelConfigByCloud()
    importRoundModalShow.value = false
    ms.success(`${t('common.success')}, ${t('common.refreshPage')}`)
  }
  catch {
    ms.error(t('review.importRetry'))
  }
  finally {
    loading.value = false
  }
}

</script>

<template>
  <div class="zpanel-settings-page">
    <NAlert type="info" :bordered="false">
      <p>{{ $t('apps.exportImport.tip') }}</p>
      <p>{{ $t('review.configOnly') }}</p>
      <a href="https://github.com/vivalucas/zpanel/blob/main/README.zh-CN.md#备份和恢复" target="_blank" rel="noopener noreferrer">{{ $t('review.backupGuide') }}</a>
    </NAlert>
    <div class="flex justify-center m-[50px]">
      <div class="m-[10px]">
        <NUpload
          accept=".zpanel.json"
          directory-dnd
          :default-upload="false"
          :show-file-list="false"
          @change="handleFileChange"
        >
          <NButton size="large" :loading="uploadLoading">
            <template #icon>
              <SvgIcon icon="fa6:solid-file-import" />
            </template>
            {{ $t('apps.exportImport.import') }}
          </NButton>
        </NUpload>
      </div>
      <div class="m-[10px]">
        <NButton size="large" @click="importItems = ['icons', 'style']; checkedItems = [...importItems]; exportRoundModalShow = true">
          <template #icon>
            <SvgIcon icon="fa6:solid-file-export" />
          </template>
          {{ $t('apps.exportImport.export') }}
        </NButton>
      </div>
    </div>
    <RoundCardModal v-model:show="importRoundModalShow" class="zpanel-settings-modal" style="max-width: 400px;" :title=" $t('apps.exportImport.import')">
      <div v-if="importWarning.length > 0">
        <NAlert :title="$t('common.warning')" type="warning">
          <div v-for="(text, index) in importWarning " :key="index">
            {{ text }}
          </div>
        </NAlert>
      </div>
      <NDivider title-placement="left">
        {{ $t('apps.exportImport.selectImportData') }}
      </NDivider>

      <NAlert type="info" :bordered="false">
        {{ $t('review.importPreview', { groups: importGroups.length, items: importCount, conflicts: conflictCount }) }}
        <p>{{ $t('review.importModeHelp') }}</p>
      </NAlert>
      <NRadioGroup v-model:value="importMode" :disabled="importAttempted" class="mt-3">
        <NRadioButton value="append">
          {{ $t('review.append') }}
        </NRadioButton>
        <NRadioButton value="replace">
          {{ $t('review.replace') }}
        </NRadioButton>
      </NRadioGroup>
      <NAlert v-if="importMode === 'replace' && checkedItems.includes('icons')" type="warning" class="mt-3">
        {{ $t('review.replaceWarning') }}
      </NAlert>
      <NSpace justify="center" style="margin-top: 20px;">
        <NCheckboxGroup v-model:value="checkedItems" :disabled="importAttempted">
          <NCheckbox v-if="importItems.includes('icons')" value="icons" :label="$t('apps.exportImport.moduleIcon')" />
          <NCheckbox v-if="importItems.includes('style')" value="style" :label="$t('apps.exportImport.moduleStyle')" />
        </NCheckboxGroup>
      </NSpace>
      <NSpace justify="center">
        <div class="mt-[50px]">
          <NButton type="primary" :disabled="checkedItems.length === 0" :loading="loading" @click="handleStartImport">
            {{ $t('common.continue') }}
          </NButton>
        </div>
      </NSpace>
    </RoundCardModal>

    <RoundCardModal v-model:show="exportRoundModalShow" class="zpanel-settings-modal" style="max-width: 400px;" :title=" $t('apps.exportImport.export')">
      <NDivider title-placement="left">
        {{ $t('apps.exportImport.selectExportData') }}
      </NDivider>

      <NSpace justify="center" style="margin-top: 20px;">
        <NCheckboxGroup v-model:value="checkedItems">
          <NCheckbox v-if="importItems.includes('icons')" value="icons" :label="$t('apps.exportImport.moduleIcon')" />
          <NCheckbox v-if="importItems.includes('style')" value="style" :label="$t('apps.exportImport.moduleStyle')" />
        </NCheckboxGroup>
      </NSpace>
      <NSpace justify="center">
        <div class="mt-[50px]">
          <NButton type="primary" :disabled="checkedItems.length === 0" :loading="loading" @click="handleStartExport">
            {{ $t('common.continue') }}
          </NButton>
        </div>
      </NSpace>
    </RoundCardModal>
  </div>
</template>
