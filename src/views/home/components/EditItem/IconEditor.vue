<script setup lang="ts">
import { NButton, NColorPicker, NInput, NUpload } from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { computed } from 'vue'
import { ItemIcon } from '@/components/common'
import { useAuthStore } from '@/store'
import { apiRespErrMsg } from '@/utils/request/apiMessage'

const props = defineProps<{
  itemIcon: Panel.ItemIcon | null
}>()
const emit = defineEmits<{
  (e: 'update:itemIcon', visible: Panel.ItemIcon): void
}>()
const authStore = useAuthStore()

const defaultSwatchesBackground = [
  '#00000000',
  '#000000',
  '#ffffff',
  '#2080F0',
  '#475569',
  '#94A3B8',
  'rgba(255, 59, 48, 0.18)',
]

const initData: Panel.ItemIcon = {
  itemType: 2,
  backgroundColor: '#2a2a2a6b',
}

const itemIconInfo = computed({
  get() {
    const v = {
      ...initData,
      ...props.itemIcon,
      backgroundColor: props.itemIcon?.backgroundColor || initData.backgroundColor,
    }
    return v
  },
  set() {
    handleChange()
  },
})

function handleIconTypeRadioChange(type: number) {
  itemIconInfo.value.itemType = type
  handleChange()
}

function handleChange() {
  emit('update:itemIcon', itemIconInfo.value || null)
}

function handleResetBackgroundColor() {
  itemIconInfo.value.backgroundColor = initData.backgroundColor
  handleChange()
}

const handleUploadFinish = ({
  file,
  event,
}: {
  file: UploadFileInfo
  event?: ProgressEvent
}) => {
  const res = JSON.parse((event?.target as XMLHttpRequest).response)
  if (res.code === 0) {
    const imageUrl = res.data.imageUrl
    itemIconInfo.value.src = imageUrl
    emit('update:itemIcon', itemIconInfo.value || null)
  }
  else {
    apiRespErrMsg(res)
  }

  return file
}
</script>

<template>
  <div class="icon-editor">
    <div class="icon-type-tabs">
      <button :class="{ active: itemIconInfo.itemType === 1 }" type="button" @click="handleIconTypeRadioChange(1)">
        {{ $t('common.text') }}
      </button>
      <button :class="{ active: itemIconInfo.itemType === 2 }" type="button" @click="handleIconTypeRadioChange(2)">
        {{ $t('common.image') }}
      </button>
      <button :class="{ active: itemIconInfo.itemType === 3 }" type="button" @click="handleIconTypeRadioChange(3)">
        {{ $t('iconItem.onlineIcon') }}
      </button>
    </div>

    <div class="icon-editor-body">
      <div class="icon-preview transparent-grid">
        <ItemIcon :item-icon="itemIconInfo" />
      </div>

      <div class="icon-editor-controls">
        <div v-if="itemIconInfo.itemType === 1">
          <NInput v-model:value="itemIconInfo.text" size="small" type="text" @input="handleChange" />
        </div>

        <div v-if="itemIconInfo.itemType === 3">
          <NInput v-model:value="itemIconInfo.text" class="mb-[8px]" size="small" type="text" :placeholder="$t('iconItem.inputIconName')" @input="handleChange" />
          <NButton size="small">
            <a target="_blank" href="https://icon-sets.iconify.design/" rel="noopener noreferrer">{{ $t('iconItem.onlineIconLibrary') }}</a>
          </NButton>
        </div>

        <div v-if="itemIconInfo.itemType === 2">
          <NInput v-model:value="itemIconInfo.src" class="mb-[8px] w-full" size="small" type="text" :placeholder="$t('iconItem.inputIconUrlOrUpload')" @input="handleChange" />
          <NUpload
            action="/api/file/uploadImg"
            :show-file-list="false"
            name="imgfile"
            :headers="{
              token: authStore.token as string,
            }"
            @finish="handleUploadFinish"
          >
            <NButton size="small">
              {{ $t('iconItem.selectUpload') }}
            </NButton>
          </NUpload>
        </div>
      </div>
    </div>

    <div class="icon-color-row">
      <div class="w-auto text-slate-500 mr-[10px]">
        {{ $t('common.backgroundColor') }}
      </div>
      <NColorPicker
        v-model:value="itemIconInfo.backgroundColor"
        size="small"
        :modes="['hex']"
        :swatches="defaultSwatchesBackground"
        @complete="handleChange"
        @update-value="handleChange"
      />
      <NButton v-if="itemIconInfo.backgroundColor !== initData.backgroundColor" size="small" @click="handleResetBackgroundColor">
        {{ $t('common.reset') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.icon-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

.icon-type-tabs {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  background: rgba(241, 245, 249, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
}

.icon-type-tabs button {
  min-height: 34px;
  padding: 0 14px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 10px;
}

.icon-type-tabs button.active {
  color: #007aff;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.icon-editor-body {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.icon-preview {
  display: grid;
  width: 86px;
  height: 86px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
}

.icon-editor-controls {
  min-width: 0;
}

.icon-color-row {
  display: grid;
  grid-template-columns: auto minmax(160px, 220px) auto;
  gap: 10px;
  align-items: center;
}

.transparent-grid {
  background-color: rgba(241, 245, 249, 0.72);
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.72) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.72) 75%),
    linear-gradient(45deg, rgba(255,255,255,0.72) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.72) 75%);
  background-position: 0 0, 8px 8px;
  background-size: 16px 16px;
}

@media (max-width: 620px) {
  .icon-editor-body,
  .icon-color-row {
    grid-template-columns: 1fr;
  }
}
</style>
