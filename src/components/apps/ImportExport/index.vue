<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { UploadFileInfo } from 'naive-ui'
import { NAlert, NButton, NCheckbox, NCheckboxGroup, NDivider, NSpace, NUpload, useMessage } from 'naive-ui'
import { RoundCardModal, SvgIcon } from '@/components/common'
import type { IconGroup, ImportJsonResult } from '@/utils/jsonImportExport'
import { ConfigVersionLowError, FormatError, exportJson, importJsonString } from '@/utils/jsonImportExport'
import { get as getAbout } from '@/api/system/about'
import { edit as addGroup, getList as getGroupList } from '@/api/panel/itemIconGroup'
import { addMultiple as addMultipleIcons, getListByGroupId } from '@/api/panel/itemIcon'
import { set as savePanelConfig } from '@/api/panel/userConfig'
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

async function importIcons(): Promise<string | null> {
  const groups = importObj.value?.geticons()
  const batchSize = 50

  if (!groups)
    return null

  try {
    for (let i = 0; i < groups.length; i++) {
      const element = groups[i]

      const createGroupResponse = await addGroup<Panel.ItemIconGroup>({
        title: element.title,
        sort: element.sort,
      })

      if (createGroupResponse.code === 0) {
        const groupId = createGroupResponse.data?.id

        if (groupId) {
          let addIcons: Panel.ItemInfo[] = []

          for (let iconI = 0; iconI < element.children.length; iconI++) {
            const iconElement = element.children[iconI]

            addIcons.push({
              title: iconElement.title,
              sort: iconElement.sort,
              icon: iconElement.icon,
              url: iconElement.url,
              lanUrl: iconElement.lanUrl,
              description: iconElement.description,
              openMethod: iconElement.openMethod,
              itemIconGroupId: groupId,
            })

            if (addIcons.length === batchSize || iconI === element.children.length - 1) {
              const response = await addMultipleIcons(addIcons)

              if (response.code !== 0)
                return response.msg

              addIcons = []
            }
          }
        }
      }
      else {
        return createGroupResponse.msg
      }
    }

    return null
  }
  catch (error) {
    if (error instanceof Error)
      return `${t('common.failed')}: ${error.message}`
    else
      return t('common.unknownError')
  }
}

async function exportIcons(): Promise<IconGroup[]> {
  const { code, data } = await getGroupList<Common.ListResponse<ItemGroup[]>>()

  if (code === 0) {
    return Promise.all(data.list.map(async (element) => {
      const group: IconGroup = {
        title: element.title as string,
        sort: element.sort ?? 99999,
        children: [],
      }

      const res = await getListByGroupId<Common.ListResponse<Panel.ItemInfo[]>>(element.id)

      if (res.code === 0) {
        for (const iconElement of res.data.list) {
          group.children.push({
            icon: iconElement.icon,
            sort: iconElement.sort || 99999,
            title: iconElement.title,
            url: iconElement.url,
            lanUrl: iconElement.lanUrl || '',
            description: iconElement.description || '',
            openMethod: iconElement.openMethod || 1,
          })
        }
      }

      return group
    }))
  }
  return []
}

async function importStyle(): Promise<string | null> {
  const styleConfig = importObj.value?.getStyleConfig()
  if (!styleConfig)
    return null
  try {
    panelState.panelConfig = { ...panelState.panelConfig, ...styleConfig }
    panelState.recordState()
    const res = await savePanelConfig({ panel: panelState.panelConfig })
    return res.code === 0 ? null : res.msg
  }
  catch {
    return t('common.serverError')
  }
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
  try {
    let hasError = false
    if (checkedItems.value.includes('icons')) {
      const errMsg = await importIcons()
      if (errMsg !== null) {
        hasError = true
        ms.error(`${t('common.failed')}:${errMsg}`)
      }
    }
    if (checkedItems.value.includes('style')) {
      const errMsg = await importStyle()
      if (errMsg !== null) {
        hasError = true
        ms.error(`${t('common.failed')}:${errMsg}`)
      }
    }

    if (!hasError) {
      importRoundModalShow.value = false
      ms.success(`${t('common.success')}, ${t('common.refreshPage')}`)
    }
    else {
      ms.warning(`${t('common.failed')}: ${t('common.repeatLater')}`)
    }
  }
  catch {
    ms.error(t('common.serverError'))
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
        <NButton size="large" @click="exportRoundModalShow = !exportRoundModalShow">
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

      <NSpace justify="center" style="margin-top: 20px;">
        <NCheckboxGroup v-model:value="checkedItems">
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
