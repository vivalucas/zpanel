<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NAvatar, NButton, NCheckbox, NInput, useMessage } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useModuleConfig } from '@/store/modules'
import { useAuthStore } from '@/store'
import { VisitMode } from '@/enums/auth'
import { openExternalUrl } from '@/utils/cmn'
import { t } from '@/locales'

import SvgSrcBaidu from '@/assets/search_engine_svg/baidu.svg'
import SvgSrcBing from '@/assets/search_engine_svg/bing.svg'
import SvgSrcGoogle from '@/assets/search_engine_svg/google.svg'

withDefaults(defineProps<{
  background?: string
  textColor?: string
}>(), {
  background: '#2a2a2a6b',
  textColor: 'white',
})

const emits = defineEmits(['itemSearch'])

interface State {
  currentSearchEngine: DeskModule.SearchBox.SearchEngine
  searchEngineList: DeskModule.SearchBox.SearchEngine[]
  newWindowOpen: boolean
}

const moduleConfigName = 'deskModuleSearchBox'
const moduleConfig = useModuleConfig()
const authStore = useAuthStore()
const ms = useMessage()
const searchTerm = ref('')
const isFocused = ref(false)
const searchSelectListShow = ref(false)
const newEngine = ref<DeskModule.SearchBox.SearchEngine>({
  iconSrc: '',
  title: '',
  url: '',
})
function createDefaultSearchEngineList(): DeskModule.SearchBox.SearchEngine[] {
  return [
    {
      iconSrc: SvgSrcGoogle,
      title: 'Google',
      url: 'https://www.google.com/search?q=%s',
    },
    {
      iconSrc: SvgSrcBaidu,
      title: 'Baidu',
      url: 'https://www.baidu.com/s?wd=%s',
    },
    {
      iconSrc: SvgSrcBing,
      title: 'Bing',
      url: 'https://www.bing.com/search?q=%s',
    },
  ]
}

function createDefaultState(): State {
  const searchEngineList = createDefaultSearchEngineList()
  return {
    currentSearchEngine: { ...searchEngineList[0] },
    searchEngineList,
    newWindowOpen: false,
  }
}

function normalizeState(saved: Partial<State> | null | undefined): State {
  const defaultState = createDefaultState()
  if (!saved)
    return defaultState

  const searchEngineList = (saved.searchEngineList?.length ? saved.searchEngineList : defaultState.searchEngineList).map(item => ({ ...item }))
  const currentSearchEngine = searchEngineList.find(item =>
    item.title === saved.currentSearchEngine?.title
    && item.url === saved.currentSearchEngine?.url
    && item.iconSrc === saved.currentSearchEngine?.iconSrc,
  ) || searchEngineList[0]

  return {
    currentSearchEngine: { ...currentSearchEngine },
    searchEngineList,
    newWindowOpen: !!saved.newWindowOpen,
  }
}

const state = ref<State>(createDefaultState())

const onFocus = (): void => {
  isFocused.value = true
}

const onBlur = (): void => {
  isFocused.value = false
}

function handleEngineClick() {
  // 访客模式不允许修改
  if (authStore.visitMode === VisitMode.VISIT_MODE_PUBLIC)
    return
  searchSelectListShow.value = !searchSelectListShow.value
}

function handleEngineUpdate(engine: DeskModule.SearchBox.SearchEngine) {
  state.value.currentSearchEngine = { ...engine }
  saveSearchState()
  searchSelectListShow.value = false
}

function saveSearchState() {
  moduleConfig.saveToCloud(moduleConfigName, state.value).catch(() => {
    ms.error(t('common.serverError'))
  })
}

function addSearchEngine() {
  const title = newEngine.value.title.trim()
  const url = newEngine.value.url.trim()
  if (!title || !url)
    return
  state.value.searchEngineList.push({
    iconSrc: newEngine.value.iconSrc.trim(),
    title,
    url,
  })
  newEngine.value = { iconSrc: '', title: '', url: '' }
  saveSearchState()
}

function removeSearchEngine(index: number) {
  if (state.value.searchEngineList.length <= 1)
    return
  const removed = state.value.searchEngineList.splice(index, 1)[0]
  if (removed && removed.title === state.value.currentSearchEngine.title && removed.url === state.value.currentSearchEngine.url)
    state.value.currentSearchEngine = { ...state.value.searchEngineList[0] }
  saveSearchState()
}

function handleSearchClick() {
  const url = state.value.currentSearchEngine.url
  const keyword = searchTerm
  // 如果网址中存在 %s，则直接替换为关键字
  const fullUrl = replaceOrAppendKeywordToUrl(url, keyword.value)
  handleClearSearchTerm()
  if (state.value.newWindowOpen)
    openExternalUrl(fullUrl)
  else
    window.location.href = fullUrl
}

function replaceOrAppendKeywordToUrl(url: string, keyword: string) {
  // 如果网址中存在 %s，则直接替换为关键字
  if (url.includes('%s'))
    return url.replace('%s', encodeURIComponent(keyword))

  // 如果网址中不存在 %s，则将关键字追加到末尾
  return url + (keyword ? `${encodeURIComponent(keyword)}` : '')
}

const handleItemSearch = () => {
  emits('itemSearch', searchTerm.value)
}

function handleClearSearchTerm() {
  searchTerm.value = ''
  emits('itemSearch', searchTerm.value)
}

onMounted(() => {
  moduleConfig.getValueByNameFromCloud<State>('deskModuleSearchBox').then(({ code, data }) => {
    if (code === 0)
      state.value = normalizeState(data)
    else
      state.value = createDefaultState()
  }).catch(() => {
    state.value = createDefaultState()
  })
})
</script>

<template>
  <div class="search-box w-full" @keydown.enter="handleSearchClick" @keydown.esc="handleClearSearchTerm">
    <div class="search-container flex rounded-2xl items-center justify-center text-white w-full" :style="{ background, color: textColor }" :class="{ focused: isFocused }">
      <div class="search-box-btn-engine w-[40px] flex justify-center cursor-pointer" @click="handleEngineClick">
        <NAvatar :src="state.currentSearchEngine.iconSrc" style="background-color: transparent;" :size="20" />
      </div>

      <input v-model="searchTerm" :placeholder="$t('deskModule.searchBox.inputPlaceholder')" @focus="onFocus" @blur="onBlur" @input="handleItemSearch">

      <div v-if="searchTerm !== ''" class="search-box-btn-clear w-[25px] mr-[10px] flex justify-center cursor-pointer" @click="handleClearSearchTerm">
        <SvgIcon style="width: 20px;height: 20px;" icon="line-md:close-small" />
      </div>
      <div class="search-box-btn-search w-[25px] flex justify-center cursor-pointer" @click="handleSearchClick">
        <SvgIcon style="width: 20px;height: 20px;" icon="iconamoon:search-fill" />
      </div>
    </div>

    <!-- 搜索引擎选择 -->
    <div v-if="searchSelectListShow" class="w-full mt-[10px] rounded-xl p-[10px]" :style="{ background }">
      <div class="flex items-center">
        <div class="flex items-center">
          <div
            v-for="item in state.searchEngineList"
            :key="`${item.title}-${item.url}`"
            :title="item.title"
            class="w-[40px] h-[40px] mr-[10px]  cursor-pointer bg-[#ffffff] flex items-center justify-center rounded-xl"
            @click="handleEngineUpdate(item)"
          >
            <NAvatar v-if="item.iconSrc" :src="item.iconSrc" style="background-color: transparent;" :size="20" />
            <span v-else class="text-slate-600 text-xs">{{ item.title.slice(0, 2) }}</span>
          </div>
        <!-- <div class="w-[40px] h-[40px] ml-[10px] flex justify-center items-center cursor-pointer" @click="handleEngineClick">
          <NAvatar style="background-color: transparent;" :size="30">
            <SvgIcon icon="lets-icons:setting-alt-fill" style="font-size: 20px;" />
          </NAvatar>
        </div> -->
        </div>
      </div>

      <div class="mt-[10px]">
        <NCheckbox v-model:checked="state.newWindowOpen" @update-checked="saveSearchState">
          <span :style="{ color: textColor }">
            {{ $t('deskModule.searchBox.openWithNewOpen') }}
          </span>
        </NCheckbox>
      </div>
      <div class="mt-[10px] grid grid-cols-1 gap-2">
        <NInput v-model:value="newEngine.title" size="small" :placeholder="$t('deskModule.searchBox.engineNamePlaceholder')" />
        <NInput v-model:value="newEngine.url" size="small" :placeholder="$t('deskModule.searchBox.engineUrlPlaceholder')" />
        <NInput v-model:value="newEngine.iconSrc" size="small" :placeholder="$t('deskModule.searchBox.engineIconPlaceholder')" />
        <div class="flex gap-2 flex-wrap">
          <NButton size="tiny" type="primary" @click="addSearchEngine">
            {{ $t('deskModule.searchBox.addEngine') }}
          </NButton>
          <NButton
            v-for="item, index in state.searchEngineList"
            :key="`${item.title}-${item.url}`"
            size="tiny"
            quaternary
            type="error"
            @click="removeSearchEngine(index)"
          >
            {{ $t('deskModule.searchBox.deleteEngine', { title: item.title }) }}
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  border: 1px solid #ccc;
  transition: box-shadow 0.5s,backdrop-filter 0.5s;
  padding: 2px 10px;
  backdrop-filter:blur(2px)
}

.focused, .search-container:hover {
  box-shadow: 0px 0px 30px -5px rgba(41, 41, 41, 0.45);
  -webkit-box-shadow: 0px 0px 30px -5px rgba(0, 0, 0, 0.45);
  -moz-box-shadow: 0px 0px 30px -5px rgba(0, 0, 0, 0.45);
  backdrop-filter:blur(5px)
}

.before {
  left: 10px;
}

.after {
  right: 10px;
}

input {
  background-color: transparent;
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 10px 5px;
  border: none;
  outline: none;
  font-size: 17px;
}
</style>
