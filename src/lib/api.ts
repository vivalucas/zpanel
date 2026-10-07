import { usePreferences } from '@/app/store'
import { sanitizePanelConfig } from './panelConfig'

export interface ApiResponse<T> {
	code: number
	msg: string
	data: T
}
export class ApiError extends Error {
	constructor(
		public code: number,
		message: string,
	) {
		super(message)
		this.name = 'ApiError'
	}
}
export const apiBase = (import.meta.env.VITE_GLOB_API_URL || '/api').replace(/\/$/, '')
export async function request<T>(
	path: string,
	data?: unknown,
	options: {
		signal?: AbortSignal
		method?: 'GET' | 'POST'
		token?: string | null
		sessionToken?: string | null
	} = {},
): Promise<T> {
	const state = usePreferences.getState()
	const token = options.token === undefined ? state.token : options.token
	if (options.sessionToken !== undefined && state.token !== options.sessionToken)
		throw new DOMException('Session changed', 'AbortError')
	const form = data instanceof FormData
	const response = await fetch(`${apiBase}${path}`, {
		method: options.method || 'POST',
		signal: options.signal,
		headers: {
			...(form ? {} : { 'Content-Type': 'application/json' }),
			...(token ? { token, Authorization: `Bearer ${token}` } : {}),
			lang: state.language.toLowerCase(),
		},
		body: options.method === 'GET' ? undefined : form ? data : JSON.stringify(data ?? {}),
	})
	if (options.token === undefined && usePreferences.getState().token !== token)
		throw new DOMException('Session changed', 'AbortError')
	if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`)
	const result: ApiResponse<T> = await response.json()
	if (options.token === undefined && usePreferences.getState().token !== token)
		throw new DOMException('Session changed', 'AbortError')
	if (result.code !== 0) {
		if ([1000, 1001].includes(result.code) && token && usePreferences.getState().token === token)
			usePreferences.getState().forgetAccount(token)
		throw new ApiError(result.code, result.msg || 'Request failed')
	}
	return result.data
}
export interface AuthInfo {
	user: User.Info
	visitMode: number
}
export interface LoginConfig {
	loginCaptcha: boolean
	siteSetting: System.SiteSetting
}
export interface Group extends Panel.ItemIconGroup {
	id: number
	items: Panel.ItemInfo[]
}
export const defaultPanel: Panel.panelConfig = {
	logoText: 'ZPanel',
	logoImageSrc: '',
	backgroundImageSrc: '',
	backgroundBlur: 0,
	backgroundMaskNumber: 0.2,
	iconStyle: 1,
	iconTextColor: '',
	iconTextInfoHideDescription: false,
	iconTextIconHideTitle: false,
	clockShowSecond: false,
	clockColor: '',
	searchBoxShow: true,
	searchBoxSearchIcon: true,
	marginTop: 10,
	marginBottom: 10,
	marginX: 5,
	maxWidth: 1200,
	maxWidthUnit: 'px',
	footerHtml:
		'Powered by <a href="https://github.com/vivalucas/zpanel" target="_blank" rel="noopener noreferrer">ZPanel</a>',
	systemMonitorShow: false,
	systemMonitorShowTitle: true,
	systemMonitorPublicVisitModeShow: false,
	netModeChangeButtonShow: true,
}
export async function fetchPanel(signal?: AbortSignal, sessionRequest = request) {
	try {
		const data = await sessionRequest<Panel.userConfig>('/panel/userConfig/get', {}, { signal })
		const clean = sanitizePanelConfig(data.panel)
		return {
			...data,
			panelWarnings: [...new Set([...(data.panelWarnings || []), ...clean.warnings])],
			panel: { ...defaultPanel, ...clean.panel },
		}
	} catch (error) {
		if (error instanceof ApiError && error.code === 1202)
			return { panel: { ...defaultPanel }, panelWarnings: [] }
		throw error
	}
}
export async function fetchGroups(signal?: AbortSignal, sessionRequest = request): Promise<Group[]> {
	return sessionRequest<Group[]>('/panel/itemIconGroup/getNavigation', {}, { signal })
}
export async function uploadImage(file: Blob, sessionRequest = request) {
	const form = new FormData()
	form.append('imgfile', file)
	return sessionRequest<{ imageUrl: string; fileId: number }>('/file/uploadImg', form)
}
export function getModule<T>(name: string, signal?: AbortSignal) {
	return request<T | null>('/system/moduleConfig/getByName', { name: `module-${name}` }, { signal })
}
export function saveModule(name: string, value: unknown) {
	return request('/system/moduleConfig/save', { name: `module-${name}`, value })
}
export interface Engine {
	title: string
	url: string
	iconSrc?: string
}
export interface SearchConfig {
	searchEngineList: Engine[]
	currentSearchEngine: Engine
	newWindowOpen: boolean
}
const engines = [
	{ title: 'Google', url: 'https://www.google.com/search?q=%s' },
	{ title: 'Bing', url: 'https://www.bing.com/search?q=%s' },
	{ title: 'Baidu', url: 'https://www.baidu.com/s?wd=%s' },
]
export const defaultSearch: SearchConfig = {
	searchEngineList: engines,
	currentSearchEngine: engines[0],
	newWindowOpen: true,
}
export interface MonitorItem {
	key: string
	monitorType: 'cpu' | 'memory' | 'disk'
	description?: string
	extendParam?: {
		path?: string
		progressColor?: string
		progressRailColor?: string
		color?: string
		backgroundColor?: string
	}
}
export const defaultMonitors: MonitorItem[] = [
	{ key: 'cpu', monitorType: 'cpu' },
	{ key: 'memory', monitorType: 'memory' },
]
