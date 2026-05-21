<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { NButton, NButtonGroup, NDataTable, NInput, NModal, NTag, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import { dockerAction, getDockerContainers, getDockerLogs, getDockerStats } from '@/api/system/systemMonitor'
import { t } from '@/locales'

const ms = useMessage()
const loading = ref(false)
const containers = ref<System.DockerContainer[]>([])
const stats = ref<Record<string, System.DockerStats>>({})
const logModalShow = ref(false)
const logs = ref('')

async function refresh() {
  loading.value = true
  try {
    const res = await getDockerContainers<Common.ListResponse<System.DockerContainer[]>>()
    if (res.code === 0)
      containers.value = res.data.list || []
    else
      ms.error(res.msg)

    const statsRes = await getDockerStats<System.DockerStats[]>()
    if (statsRes.code === 0) {
      stats.value = Object.fromEntries((statsRes.data || []).map(item => [item.ID, item]))
    }
  }
  finally {
    loading.value = false
  }
}

async function runAction(id: string, action: string) {
  const res = await dockerAction(id, action)
  if (res.code === 0) {
    ms.success(t('common.success'))
    refresh()
  }
  else {
    ms.error(res.msg)
  }
}

async function openLogs(id: string) {
  const res = await getDockerLogs<{ logs: string }>(id)
  if (res.code === 0) {
    logs.value = res.data.logs
    logModalShow.value = true
  }
  else {
    ms.error(res.msg)
  }
}

const columns: DataTableColumns<System.DockerContainer> = [
  {
    title: t('apps.dockerManager.container'),
    key: 'names',
    render(row) {
      return h('div', [
        h('div', { class: 'font-bold' }, row.names),
        h('div', { class: 'text-xs text-slate-500' }, row.image),
      ])
    },
  },
  {
    title: t('apps.dockerManager.status'),
    key: 'state',
    render(row) {
      const running = row.state === 'running'
      return h(NTag, { type: running ? 'success' : 'default', size: 'small' }, { default: () => row.status })
    },
  },
  {
    title: t('apps.dockerManager.resources'),
    key: 'stats',
    render(row) {
      const item = stats.value[row.id] || stats.value[row.names] || {}
      return h('div', { class: 'text-xs' }, [
        h('div', `CPU ${item.CPUPerc || '-'}`),
        h('div', `MEM ${item.MemUsage || '-'}`),
        h('div', `NET ${item.NetIO || '-'}`),
      ])
    },
  },
  {
    title: t('apps.dockerManager.ports'),
    key: 'ports',
  },
  {
    title: t('common.action'),
    key: 'actions',
    render(row) {
      return h(NButtonGroup, {}, {
        default: () => [
          h(NButton, { size: 'tiny', tertiary: true, onClick: () => runAction(row.id, 'start') }, { default: () => t('apps.dockerManager.start') }),
          h(NButton, { size: 'tiny', tertiary: true, onClick: () => runAction(row.id, 'restart') }, { default: () => t('apps.dockerManager.restart') }),
          h(NButton, { size: 'tiny', tertiary: true, type: 'warning', onClick: () => runAction(row.id, 'stop') }, { default: () => t('apps.dockerManager.stop') }),
          h(NButton, { size: 'tiny', tertiary: true, onClick: () => openLogs(row.id) }, { default: () => t('apps.dockerManager.logs') }),
        ],
      })
    },
  },
]

onMounted(refresh)
</script>

<template>
  <div class="bg-slate-200 dark:bg-zinc-900 p-2 h-full">
    <div class="mb-2">
      <NButton size="small" type="primary" :loading="loading" @click="refresh">
        {{ $t('common.refresh') }}
      </NButton>
    </div>
    <NDataTable :columns="columns" :data="containers" :loading="loading" :bordered="false" />
    <NModal v-model:show="logModalShow" preset="card" style="max-width: 900px" :title="$t('apps.dockerManager.containerLogs')">
      <NInput :value="logs" type="textarea" readonly :autosize="{ minRows: 18, maxRows: 28 }" />
    </NModal>
  </div>
</template>
