import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useRef } from 'react'
import {
	defaultMonitors,
	defaultSearch,
	fetchGroups,
	fetchPanel,
	getModule,
	READ_REQUEST_TIMEOUT_MS,
	request,
} from './api'
import type { AuthInfo, LoginConfig, MonitorItem, SearchConfig } from './api'
import { usePreferences } from '@/app/store'
import { bindHomeCache, discardHomeCache } from './homeCache'
import { isAccessError } from './queryState'

export function useAuth(restoreHome = true) {
	const client = useQueryClient()
	const restoreRef = useRef(restoreHome)
	useLayoutEffect(() => {
		restoreRef.current = restoreHome
	}, [restoreHome])
	return useQuery({
		queryKey: ['auth'],
		queryFn: async ({ signal }) => {
			const token = usePreferences.getState().token
			try {
				const auth = await request<AuthInfo>(
					'/user/getAuthInfo',
					{},
					{ signal, timeoutMs: READ_REQUEST_TIMEOUT_MS },
				)
				if (token)
					bindHomeCache(client, auth, () => usePreferences.getState().token === token, restoreRef.current)
				return auth
			} catch (error) {
				if (isAccessError(error) && usePreferences.getState().token === token) discardHomeCache(client)
				throw error
			}
		},
		staleTime: 60_000,
	})
}
export const useSite = () =>
	useQuery({
		queryKey: ['site'],
		queryFn: ({ signal }) =>
			request<LoginConfig>('/openness/loginConfig', undefined, {
				method: 'GET',
				signal,
				timeoutMs: READ_REQUEST_TIMEOUT_MS,
			}),
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
