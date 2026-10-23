import { usePreferences } from '@/app/store'
import { request } from './api'
import { useCallback, useEffect, useRef } from 'react'

export function useSessionRequest(): typeof request {
	const sessionToken = usePreferences((s) => s.token)
	const lifetimeRef = useRef<AbortController | null>(null)
	useEffect(() => {
		const controller = new AbortController()
		lifetimeRef.current = controller
		return () => controller.abort()
	}, [sessionToken])
	return useCallback(
		<T>(path: string, data?: unknown, options?: Parameters<typeof request>[2]): Promise<T> => {
			const signal = lifetimeRef.current?.signal
			if (!signal || signal.aborted) return Promise.reject(new DOMException('Page closed', 'AbortError'))
			if (!options?.signal) return request<T>(path, data, { ...options, sessionToken, signal })
			// Merge page lifetime and caller cancellation without requiring AbortSignal.any.
			const controller = new AbortController()
			const signals = [signal, options.signal]
			const abort = () => controller.abort()
			for (const source of signals) {
				if (source.aborted) abort()
				else source.addEventListener('abort', abort, { once: true })
			}
			return request<T>(path, data, { ...options, sessionToken, signal: controller.signal }).finally(() => {
				for (const source of signals) source.removeEventListener('abort', abort)
			})
		},
		[sessionToken],
	)
}
