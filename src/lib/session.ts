import { usePreferences } from '@/app/store'
import { request } from './api'

export function useSessionRequest(): typeof request {
	const sessionToken = usePreferences((s) => s.token)
	return (path, data, options) => request(path, data, { ...options, sessionToken })
}
