import { ss } from '@/utils/storage'
// import userDefaultAvatar from '@/assets/userDefaultAvatar.png'

const LOCAL_NAME = 'moduleConfig'

export interface Config {
  name: string
  config: Record<string, unknown>
}

export interface ModuleConfigState {
  [key: string]: Record<string, unknown> | undefined
}

export function getLocalState(): ModuleConfigState {
  const localSetting: ModuleConfigState | undefined = ss.get(LOCAL_NAME)
  return { ...localSetting }
}

export function setLocalState(setting: ModuleConfigState): void {
  ss.set(LOCAL_NAME, setting)
}
