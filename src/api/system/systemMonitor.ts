import { post } from '@/utils/request'

export function getAll<T>() {
  return post<T>({
    url: '/system/monitor/getAll',
  })
}

export function getCpuState<T>() {
  return post<T>({
    url: '/system/monitor/getCpuState',
  })
}

export function getDiskStateByPath<T>(path: string) {
  return post<T>({
    url: '/system/monitor/getDiskStateByPath',
    data: { path },
  })
}

export function getMemonyState<T>() {
  return post<T>({
    url: '/system/monitor/getMemonyState',
  })
}

export function getDiskMountpoints<T>() {
  return post<T>({
    url: '/system/monitor/getDiskMountpoints',
  })
}

export function getDockerContainers<T>() {
  return post<T>({
    url: '/system/docker/containers',
  })
}

export function getDockerStats<T>() {
  return post<T>({
    url: '/system/docker/stats',
  })
}

export function dockerAction<T>(id: string, action: string) {
  return post<T>({
    url: '/system/docker/action',
    data: { id, action },
  })
}

export function getDockerLogs<T>(id: string, lines = 200) {
  return post<T>({
    url: '/system/docker/logs',
    data: { id, lines },
  })
}
