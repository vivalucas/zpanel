import { post } from '@/utils/request'

export function get<T>() {
  return post<T>({
    url: '/about',
  })
}

export function getSiteSetting<T>() {
  return post<T>({
    url: '/system/siteSetting/get',
  })
}

export function setSiteSetting<T>(data: System.SiteSettingRequest) {
  return post<T>({
    url: '/system/siteSetting/set',
    data,
  })
}
