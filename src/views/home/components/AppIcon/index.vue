<script setup lang="ts">
import { computed } from 'vue'
import { NEllipsis } from 'naive-ui'
import { ItemIcon } from '@/components/common'
import { PanelPanelConfigStyleEnum } from '@/enums'

interface Prop {
  itemInfo?: Panel.ItemInfo
  size?: number // 默认70
  forceBackground?: string // 强制背景色
  iconTextColor?: string
  iconTextInfoHideDescription: boolean
  iconTextIconHideTitle: boolean
  style: PanelPanelConfigStyleEnum
}

const props = withDefaults(defineProps<Prop>(), {
  size: 70,
})

const defaultBackground = 'rgba(255, 255, 255, 0.68)'

const calculateLuminance = (color: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(color))
    return 1

  const hex = color.replace(/^#/, '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

const textColor = computed(() => {
  const luminance = calculateLuminance(props.itemInfo?.icon?.backgroundColor || defaultBackground)
  return luminance > 0.5 ? 'black' : 'white'
})
</script>

<template>
  <div class="app-icon w-full">
    <!-- 详情图标 -->
    <div
      v-if="style === PanelPanelConfigStyleEnum.info"
      class="app-icon-info w-full rounded-2xl transition-all duration-200 flex"
      :style="{ background: itemInfo?.icon?.backgroundColor || defaultBackground }"
    >
      <!-- 图标 -->
      <div class="app-icon-info-icon w-[70px] h-[70px]">
        <div class="w-[70px] h-full flex items-center justify-center ">
          <ItemIcon :item-icon="itemInfo?.icon" force-background="transparent" :size="50" class="overflow-hidden rounded-xl" />
        </div>
      </div>

      <!-- 文字 -->
      <!-- 如果为纯白色，将自动根据背景的明暗计算字体的黑白色 -->
      <div class="text-white flex items-center" :style="{ color: (iconTextColor === '#ffffff') ? textColor : iconTextColor, maxWidth: 'calc(100% - 80px)' }">
        <div class="app-icon-info-text-box w-full">
          <div class="app-icon-info-text-box-title font-semibold w-full">
            <NEllipsis>
              {{ itemInfo?.title }}
            </NEllipsis>
          </div>
          <div v-if="!iconTextInfoHideDescription" class="app-icon-info-text-box-description">
            <NEllipsis :line-clamp="2" class="text-xs">
              {{ itemInfo?.description }}
            </NEllipsis>
          </div>
        </div>
      </div>
    </div>

    <!-- 极简(小)图标（APP） -->
    <div v-if="style === PanelPanelConfigStyleEnum.icon" class="app-icon-small">
      <div
        class="app-icon-small-icon overflow-hidden rounded-2xl zpanel w-[70px] h-[70px] mx-auto rounded-2xl transition-all duration-200"
        :title="itemInfo?.description"
      >
        <ItemIcon :item-icon="itemInfo?.icon" />
      </div>
      <div
        v-if="!iconTextIconHideTitle"
        class="app-icon-small-title text-center app-icon-text-shadow cursor-pointer mt-[2px]"
        :style="{ color: iconTextColor }"
      >
        <span>{{ itemInfo?.title }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-icon-info,
.app-icon-small-icon {
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px) saturate(1.25);
}

.app-icon-info:hover,
.app-icon-small-icon:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 46px rgba(15, 23, 42, 0.16);
}

.app-icon-small-title {
  margin-top: 8px;
  font-weight: 650;
  line-height: 1.3;
  text-shadow: none;
}
</style>
