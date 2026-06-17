<script lang="ts" setup>
import { h, onMounted, reactive, ref } from 'vue'
import { NAlert, NButton, NDataTable, NDropdown, NInput, NTag, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import EditUser from './EditUser/index.vue'
import { getPublicVisitUser, setPublicVisitUser, deletes as usersDeletes, getList as usersGetList } from '@/api/panel/users'
import { SvgIcon } from '@/components/common'
import { useAuthStore } from '@/store'
import { t } from '@/locales'
import { AdminAuthRole } from '@/enums/admin'

const message = useMessage()
const authStore = useAuthStore()
const tableIsLoading = ref<boolean>(false)
const editUserDialogShow = ref<boolean>(false)
const keyword = ref('')
const editUserUserInfo = ref<User.Info>()
const dialog = useDialog()
const publicVisitUserId = ref<number | null>(null)

const createColumns = ({
  update,
}: {
  update: (row: User.Info) => void
}): DataTableColumns<User.Info> => {
  return [
    {
      title: t('common.username'),
      key: 'username',
      render(row: User.Info) {
        let publicVisitHtml = ''
        if (publicVisitUserId.value && publicVisitUserId.value === row.id)
          publicVisitHtml = `[${t('adminSettingUsers.pblicText')}]-`

        if (row.username === authStore.userInfo?.username)
          return `${publicVisitHtml}${row.username} (${t('adminSettingUsers.currentUseUsername')})`
        return publicVisitHtml + row.username
      },
    },
    {
      title: t('common.nikeName'),
      key: 'name',
    },
    {
      title: t('adminSettingUsers.role'),
      key: 'role',
      render(row) {
        switch (row.role) {
          case AdminAuthRole.admin:
            return h(NTag, { type: 'info' }, { default: () => t('common.role.admin') })
          case AdminAuthRole.regularUser:
            return h(NTag, {}, { default: () => t('common.role.regularUser') })
          default:
            return '-'
        }
      },
    },
    {
      title: t('common.action'),
      key: '',
      render(row) {
        const btn = h(
          NButton,
          {
            size: 'small',
          },
          {
            default() {
              return h(
                SvgIcon, {
                  icon: 'mingcute:more-1-fill',
                },
              )
            },
          },
        )

        return h(NDropdown, {
          trigger: 'click',
          onSelect(key: string | number) {
            switch (key) {
              case 'update':
                update(row)
                break
              case 'publicMode': {
                if (typeof row.id !== 'number')
                  return
                const rowId = row.id

                // 取消
                if (publicVisitUserId.value === rowId) {
                  setPublicVisitUser(null).then(({ code }) => {
                    if (code === 0)
                      publicVisitUserId.value = null
                  })
                }
                else {
                // 设置
                  setPublicVisitUser(rowId).then(({ code }) => {
                    if (code === 0)
                      publicVisitUserId.value = rowId
                  })
                }
                break
              }
              case 'delete':
                dialog.warning({
                  title: t('common.warning'),
                  content: t('adminSettingUsers.deletePromptContent', { name: row.name, username: row.username }),
                  positiveText: t('common.confirm'),
                  negativeText: t('common.cancel'),
                  onPositiveClick: () => {
                    if (typeof row.id === 'number')
                      deletes([row.id])
                  },
                })
                break

              default:
                break
            }
          },
          options: [
            {
              label: t('common.edit'),
              key: 'update',
            },
            {
              label: t('adminSettingUsers.setOrUnsetPublicMode'),
              key: 'publicMode',
            },
            {
              label: t('common.delete'),
              key: 'delete',
            },
          ],
        }, { default: () => btn })
      },
    },
  ]
}

const userList = ref<User.Info[]>()

const columns = createColumns({
  update(row: User.Info) {
    editUserUserInfo.value = row
    editUserDialogShow.value = true
  },
})
const pagination = reactive({
  page: 1,
  showSizePicker: true,
  pageSizes: [10, 30, 50, 100],
  pageSize: 10,
  itemCount: 0,
  onChange: (page: number) => {
    pagination.page = page
    getList(null)
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    getList(null)
  },
  prefix(item: PaginationProps) {
    return t('adminSettingUsers.userCountText', { count: item.itemCount })
  },
})

function handlePageChange(page: number) {
  getList(page)
}

// 添加
function handleAdd() {
  editUserDialogShow.value = true
  editUserUserInfo.value = {}
}

function handleDone() {
  editUserDialogShow.value = false
  message.success(t('common.success'))
  getList(null)
}

async function getList(page: number | null) {
  tableIsLoading.value = true
  const currentPage = page || pagination.page
  const req: AdminUserManage.GetListRequest = {
    page: currentPage,
    limit: pagination.pageSize,
  }
  const search = keyword.value.trim()
  if (search)
    req.keyword = search

  try {
    const { data } = await usersGetList<Common.ListResponse<User.Info[]>>(req)
    pagination.page = currentPage
    pagination.itemCount = data.count
    if (data.list)
      userList.value = data.list
  }
  catch {
    message.error(t('common.networkError'))
  }
  finally {
    tableIsLoading.value = false
  }
}

async function deletes(ids: number[]) {
  const { code } = await usersDeletes(ids)
  if (code === 0) {
    message.success(t('common.deleteSuccess'))
    getList(null)
  }
}

onMounted(() => {
  getPublicVisitUser<User.Info>().then(({ data }) => {
    publicVisitUserId.value = data?.id || null
  }).catch(() => {
    publicVisitUserId.value = null
  })
  getList(null)
})
</script>

<template>
  <div class="zpanel-settings-page">
    <NAlert type="info" :bordered="false">
      {{ $t('adminSettingUsers.alertText') }}
    </NAlert>
    <div class="my-[10px] users-toolbar">
      <NButton type="primary" size="small" @click="handleAdd">
        {{ $t('common.add') }}
      </NButton>
      <NInput
        v-model:value="keyword"
        class="users-search"
        clearable
        size="small"
        :placeholder="$t('common.inputPlaceholder')"
        @keyup.enter="getList(1)"
        @clear="getList(1)"
      />
      <NButton size="small" @click="getList(1)">
        {{ $t('common.search') }}
      </NButton>
    </div>

    <NDataTable
      :columns="columns"
      :data="userList"
      :pagination="pagination"
      :bordered="false"
      :loading="tableIsLoading"
      :remote="true"

      @update:page="handlePageChange"
    />
    <EditUser v-model:visible="editUserDialogShow" :user-info="editUserUserInfo" @done="handleDone" />
  </div>
</template>

<style scoped>
.users-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.users-search {
  width: min(260px, 100%);
}
</style>
