import { post } from '@/utils/request'

export function getList<T>(data?: Common.ListRequest) {
  return post<T>({
    url: '/file/getList',
    data,
  })
}

export function getPublicList<T>(data?: Common.ListRequest) {
  return post<T>({
    url: '/file/getPublicList',
    data,
  })
}

export function deletes<T>(ids: number[]) {
  return post<T>({
    url: '/file/deletes',
    data: { ids },
  })
}
