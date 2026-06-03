import { ss } from '@/utils/storage'
import { PanelPanelConfigStyleEnum, PanelStateNetworkModeEnum } from '@/enums'
const LOCAL_NAME = 'panelStorage'

const defaultFooterHtml = 'Powered By <a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer">ZPanel</a>'

export function defaultStatePanelConfig(): Panel.panelConfig {
  return {
    backgroundImageSrc: '',
    backgroundBlur: 0,
    backgroundMaskNumber: 0,
    iconStyle: PanelPanelConfigStyleEnum.icon,
    iconTextColor: '#1f2937',
    iconTextInfoHideDescription: false,
    iconTextIconHideTitle: false,
    logoText: 'ZPanel',
    logoImageSrc: '',
    clockShowSecond: false,
    searchBoxShow: false,
    searchBoxSearchIcon: false,
    marginBottom: 10,
    marginTop: 10,
    maxWidth: 1200,
    maxWidthUnit: 'px',
    marginX: 5,
    footerHtml: defaultFooterHtml,
    systemMonitorShow: false,
    systemMonitorShowTitle: true,
    systemMonitorPublicVisitModeShow: false,
    netModeChangeButtonShow: true,

  }
}

export function defaultState(): Panel.State {
  return {
    rightSiderCollapsed: false,
    leftSiderCollapsed: false,
    networkMode: PanelStateNetworkModeEnum.wan,
    panelConfig: { ...defaultStatePanelConfig() },
  }
}

export function getLocalState(): Panel.State {
  const localState = ss.get(LOCAL_NAME)
  return { ...defaultState(), ...localState }
}

export function setLocalState(state: Panel.State) {
  ss.set(LOCAL_NAME, state)
}

export function removeLocalState() {
  ss.remove(LOCAL_NAME)
}
