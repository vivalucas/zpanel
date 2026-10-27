import { useCallback, useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { isUnverifiedHomeData, subscribeHomeVerification } from './homeCache'
import type { HomeQueryName } from './homeCache'

export function useUnverifiedHomeData(client: QueryClient, name: HomeQueryName) {
	const subscribe = useCallback(
		(listener: () => void) => subscribeHomeVerification(client, listener),
		[client],
	)
	const snapshot = useCallback(() => isUnverifiedHomeData(client, name), [client, name])
	return useSyncExternalStore(subscribe, snapshot, snapshot)
}
