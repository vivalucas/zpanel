<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { NModal } from 'naive-ui'
const props = defineProps<{
  title?: string
  show: boolean
  size?: 'medium' | 'small' | 'large' | 'huge' | undefined
}>()

const emit = defineEmits<Emit>()
interface Emit {
  (e: 'update:show', show: boolean): void
//   (e: 'done', item: Panel.Info): void// 创建完成
}

const attrs = useAttrs()

const bindAttrs = computed<{ class: string; style: string }>(() => ({
  class: ['zpanel-glass-modal', attrs.class as string].filter(Boolean).join(' '),
  style: (attrs.style as string) || '',
}))

// 更新值父组件传来的值
const showModal = computed({
  get: () => props.show,
  set: (show: boolean) => {
    emit('update:show', show)
  },
})
</script>

<template>
  <NModal v-model:show="showModal" preset="card" :size="size" v-bind="bindAttrs" :title="title">
    <template #cover>
      <slot name="cover" />
    </template>
    <template #header>
      <slot name="header" />
    </template>
    <template #header-extra>
      <slot name="header-extra" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
    <template #action>
      <slot name="action" />
    </template>
    <slot />
  </NModal>
</template>

<style>
.zpanel-glass-modal.n-card {
  overflow: hidden;
  color: #111827;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(203, 213, 225, 0.86);
  border-radius: 24px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(22px) saturate(1.08);
}

.zpanel-glass-modal .n-card-header {
  padding: 22px 26px 14px;
  background: rgba(255, 255, 255, 0.9);
  border-bottom: 1px solid rgba(226, 232, 240, 0.95);
}

.zpanel-glass-modal .n-card__content {
  padding: 0 22px 22px;
}

.zpanel-glass-modal .n-card-header__main {
  font-size: 18px;
  font-weight: 760;
  color: #111827;
}

.dark .zpanel-glass-modal.n-card {
  color: #e5e7eb;
  background: rgba(17, 24, 39, 0.96);
  border-color: rgba(71, 85, 105, 0.9);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
}

.dark .zpanel-glass-modal .n-card-header {
  background: rgba(15, 23, 42, 0.94);
  border-bottom-color: rgba(51, 65, 85, 0.95);
}

.dark .zpanel-glass-modal .n-card-header__main {
  color: #f8fafc;
}
</style>
