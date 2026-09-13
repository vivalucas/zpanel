import { useQuery } from '@tanstack/react-query'
import { defaultMonitors, defaultSearch, fetchGroups, fetchPanel, getModule, request } from './api'
import type { AuthInfo, LoginConfig, MonitorItem, SearchConfig } from './api'
export const useAuth = () =>
	useQuery({
		queryKey: ['auth'],
		queryFn: ({ signal }) => request<AuthInfo>('/user/getAuthInfo', {}, { signal }),
		staleTime: 60_000,
	})
export const useSite = () =>
	useQuery({
		queryKey: ['site'],
		queryFn: ({ signal }) =>
			request<LoginConfig>('/openness/loginConfig', undefined, { method: 'GET', signal }),
		staleTime: 60_000,
	})
export const usePanel = () => useQuery({ queryKey: ['panel'], queryFn: ({ signal }) => fetchPanel(signal) })
export const useGroups = () =>
	useQuery({ queryKey: ['groups'], queryFn: ({ signal }) => fetchGroups(signal) })
export const useSearchConfig = () =>
	useQuery({
		queryKey: ['search'],
		queryFn: async ({ signal }) =>
			(await getModule<SearchConfig>('deskModuleSearchBox', signal)) || defaultSearch,
	})
export const useMonitorConfig = () =>
	useQuery({
		queryKey: ['monitors'],
		queryFn: async ({ signal }) =>
			(await getModule<{ list: MonitorItem[] }>('systemMonitor', signal)) || { list: defaultMonitors },
	})
