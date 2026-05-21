import { post } from '@/utils/request'

export function getList<T>() {
  return post<T>({
    url: '/file/getList',
  })
}

export function getPublicList<T>() {
  return post<T>({
    url: '/file/getPublicList',
  })
}

export function deletes<T>(ids: number[]) {
  return post<T>({
    url: '/file/deletes',
    data: { ids },
  })
}
