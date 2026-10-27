import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, defaultPanel, defaultSearch, RequestTimeoutError } from './api'
import type { AuthInfo } from './api'
import {
	bindHomeCache,
	clearUnverifiedHomeData,
	isUnverifiedHomeData,
	stopHomeCache,
	subscribeHomeVerification,
} from './homeCache'
import { clearHomeSnapshot, HOME_CACHE_KEY, HOME_CACHE_MAX_AGE } from './homeCacheStorage'

const now = 1_800_000_000_000
const auth: AuthInfo = { user: { id: 7, role: 1, username: 'private-user' }, visitMode: 0 }
const panel = { panel: { ...defaultPanel }, panelWarnings: [] }
const groups = [
	{
		id: 1,
		title: 'Apps',
		items: [{ id: 2, title: 'NAS', url: 'https://example.com', openMethod: 2, icon: null }],
	},
]
let values: Map<string, string>
let storage: {
	getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>
	setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>
	removeItem: ReturnType<typeof vi.fn<(key: string) => void>>
}
const clients: QueryClient[] = []
const subscriptions: (() => void)[] = []

function client() {
	const value = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
	clients.push(value)
	return value
}
function saved(data: unknown, updatedAt = now - 1000) {
	return { data, updatedAt }
}
function snapshot() {
	return {
		version: 1,
		userId: auth.user.id,
		role: auth.user.role,
		queries: { panel: saved(panel), groups: saved(groups), search: saved(defaultSearch) },
	}
}
function seed(value: unknown = snapshot()) {
	values.set(HOME_CACHE_KEY, JSON.stringify(value))
}
function persisted() {
	const raw = values.get(HOME_CACHE_KEY)
	return raw ? JSON.parse(raw) : undefined
}

beforeEach(() => {
	vi.spyOn(Date, 'now').mockReturnValue(now)
	values = new Map()
	storage = {
		getItem: vi.fn((key: string) => values.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			values.set(key, value)
		}),
		removeItem: vi.fn((key: string) => {
			values.delete(key)
		}),
	}
	vi.stubGlobal('localStorage', storage)
})
afterEach(() => {
	for (const unsubscribe of subscriptions.splice(0)) unsubscribe()
	for (const value of clients.splice(0)) {
		stopHomeCache(value)
		value.clear()
	}
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe('home snapshots after fresh authentication', () => {
	it('does not restore for a new client until a current authenticated binding is provided', () => {
		seed()
		const queries = client()
		expect(queries.getQueryData(['groups'])).toBeUndefined()
		bindHomeCache(queries, auth, () => false)
		expect(queries.getQueryData(['groups'])).toBeUndefined()
		expect(storage.getItem).not.toHaveBeenCalled()
		bindHomeCache(queries, auth, () => true)
		expect(queries.getQueryData(['panel'])).toEqual(panel)
		expect(queries.getQueryData(['groups'])).toEqual(groups)
		expect(queries.getQueryData(['search'])).toEqual(defaultSearch)
		for (const name of ['panel', 'groups', 'search'])
			expect(queries.getQueryState([name])?.isInvalidated).toBe(true)
		expect(storage.setItem).not.toHaveBeenCalled()
	})

	it('revalidates even a recent restored query on mount while preserving its data', async () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		let finish!: (value: typeof groups) => void
		const newer = [{ ...groups[0], title: 'Updated apps' }]
		const queryFn = vi.fn(() => new Promise<typeof groups>((resolve) => (finish = resolve)))
		const observer = new QueryObserver(queries, { queryKey: ['groups'], queryFn, staleTime: 30_000 })
		subscriptions.push(observer.subscribe(() => undefined))
		expect(queryFn).toHaveBeenCalledTimes(1)
		expect(queries.getQueryState(['groups'])?.fetchStatus).toBe('fetching')
		expect(queries.getQueryData(['groups'])).toEqual(groups)
		const done = queries.fetchQuery({ queryKey: ['groups'], queryFn, staleTime: 30_000 })
		finish(newer)
		await done
		expect(queryFn).toHaveBeenCalledTimes(1)
		expect(queries.getQueryData(['groups'])).toEqual(newer)
		expect(queries.getQueryState(['groups'])?.isInvalidated).toBe(false)
		expect(persisted().queries.groups.data).toEqual(newer)
	})

	it('does not restore into settings but still persists a successful server read', async () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true, false)
		for (const name of ['panel', 'groups', 'search'] as const) {
			expect(queries.getQueryData([name])).toBeUndefined()
			expect(isUnverifiedHomeData(queries, name)).toBe(false)
		}
		const latest = { ...panel, panel: { ...panel.panel, logoText: 'Current server value' } }
		await queries.fetchQuery({ queryKey: ['panel'], queryFn: () => Promise.resolve(latest) })
		expect(queries.getQueryData(['panel'])).toEqual(latest)
		expect(persisted().queries.panel.data).toEqual(latest)
		expect(queries.getQueryData(['groups'])).toBeUndefined()
	})

	it('clears only unverified restored queries before settings while retaining verified server data', async () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		const latest = [{ ...groups[0], title: 'Verified on server' }]
		await queries.fetchQuery({ queryKey: ['groups'], queryFn: () => Promise.resolve(latest) })
		await expect(
			queries.fetchQuery({ queryKey: ['panel'], queryFn: () => Promise.reject(new Error('Temporarily unavailable')) }),
		).rejects.toThrow('Temporarily unavailable')
		expect(isUnverifiedHomeData(queries, 'groups')).toBe(false)
		expect(isUnverifiedHomeData(queries, 'panel')).toBe(true)
		expect(isUnverifiedHomeData(queries, 'search')).toBe(true)
		const disk = values.get(HOME_CACHE_KEY)
		clearUnverifiedHomeData(queries)
		expect(queries.getQueryData(['groups'])).toEqual(latest)
		expect(queries.getQueryData(['panel'])).toBeUndefined()
		expect(queries.getQueryData(['search'])).toBeUndefined()
		for (const name of ['panel', 'groups', 'search'] as const)
			expect(isUnverifiedHomeData(queries, name)).toBe(false)
		expect(values.get(HOME_CACHE_KEY)).toBe(disk)
	})

	it('does not treat a manual cache update as successful server verification', async () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		const latest = { ...panel, panel: { ...panel.panel, logoText: 'Manual update' } }
		queries.setQueryData(['panel'], latest)
		expect(isUnverifiedHomeData(queries, 'panel')).toBe(true)
		await queries.fetchQuery({ queryKey: ['panel'], queryFn: () => Promise.resolve(latest) })
		expect(isUnverifiedHomeData(queries, 'panel')).toBe(false)
		expect(isUnverifiedHomeData(queries, 'groups')).toBe(true)
	})

	it('notifies verification subscribers when an unchanged server response keeps the same data reference', async () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		const original = queries.getQueryData(['groups'])
		const states = [isUnverifiedHomeData(queries, 'groups')]
		const listener = vi.fn(() => states.push(isUnverifiedHomeData(queries, 'groups')))
		const unsubscribe = subscribeHomeVerification(queries, listener)
		subscriptions.push(unsubscribe)
		queries.setQueryData(['groups'], JSON.parse(JSON.stringify(groups)))
		expect(queries.getQueryData(['groups'])).toBe(original)
		expect(isUnverifiedHomeData(queries, 'groups')).toBe(true)
		expect(listener).not.toHaveBeenCalled()
		await queries.fetchQuery({
			queryKey: ['groups'],
			queryFn: () => Promise.resolve(JSON.parse(JSON.stringify(groups))),
		})
		expect(queries.getQueryData(['groups'])).toBe(original)
		expect(states).toEqual([true, false])
		expect(listener).toHaveBeenCalledTimes(1)
		unsubscribe()
		clearUnverifiedHomeData(queries)
		stopHomeCache(queries)
		expect(listener).toHaveBeenCalledTimes(1)
	})

	it.each([
		{ user: { id: 8, role: 1 }, visitMode: 0 },
		{ user: { id: 7, role: 2 }, visitMode: 0 },
	])('isolates an authenticated user or role mismatch: %j', (otherAuth) => {
		seed()
		const queries = client()
		bindHomeCache(queries, otherAuth, () => true)
		expect(queries.getQueryData(['groups'])).toBeUndefined()
		queries.setQueryData(['groups'], [])
		expect(persisted()).toMatchObject({ userId: otherAuth.user.id, role: otherAuth.user.role })
		expect(persisted().queries).toEqual({ groups: saved([], now) })
	})

	it('clears an older in-document scope before binding a different role', () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		bindHomeCache(queries, { ...auth, user: { ...auth.user, role: 2 } }, () => true)
		for (const name of ['panel', 'groups', 'search'])
			expect(queries.getQueryData([name])).toBeUndefined()
		expect(values.has(HOME_CACHE_KEY)).toBe(false)
		queries.setQueryData(['groups'], [])
		expect(persisted()).toMatchObject({ userId: 7, role: 2, queries: { groups: saved([], now) } })
	})

	it('does not restore or persist private snapshots for a public visitor', () => {
		seed()
		const before = values.get(HOME_CACHE_KEY)
		const queries = client()
		bindHomeCache(queries, { ...auth, visitMode: 1 }, () => true)
		expect(queries.getQueryData(['groups'])).toBeUndefined()
		queries.setQueryData(['groups'], [])
		expect(values.get(HOME_CACHE_KEY)).toBe(before)
		expect(storage.setItem).not.toHaveBeenCalled()
	})

	it('removes a private scope when the same client becomes a public visitor', () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		bindHomeCache(queries, { ...auth, visitMode: 1 }, () => true)
		for (const name of ['panel', 'groups', 'search'])
			expect(queries.getQueryData([name])).toBeUndefined()
		expect(values.has(HOME_CACHE_KEY)).toBe(false)
		queries.setQueryData(['groups'], [])
		expect(storage.setItem).not.toHaveBeenCalled()
	})

	it('only persists exact home data keys and excludes authentication and other query data', () => {
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		queries.setQueryData(['auth'], { ...auth, token: 'secret-token' })
		queries.setQueryData(['site'], { customJs: 'private-script' })
		queries.setQueryData(['monitor', 'cpu'], { privateMetric: true })
		queries.setQueryData(['groups', 9], [{ secret: 'other-scope' }])
		expect(storage.setItem).not.toHaveBeenCalled()
		queries.setQueryData(['panel'], panel)
		queries.setQueryData(['groups'], groups)
		queries.setQueryData(['search'], defaultSearch)
		expect(Object.keys(persisted()).sort()).toEqual(['queries', 'role', 'userId', 'version'])
		expect(Object.keys(persisted().queries).sort()).toEqual(['groups', 'panel', 'search'])
		const raw = values.get(HOME_CACHE_KEY)!
		for (const secret of ['secret-token', 'private-user', 'private-script', 'privateMetric', 'other-scope'])
			expect(raw).not.toContain(secret)
	})

	it('projects display fields when both restoring and saving expanded API objects', () => {
		const secret = 'private-extra-property'
		const expandedPanel = { ...panel, token: secret, user: auth.user, panel: { ...panel.panel, token: secret } }
		const expandedGroups = [
			{
				...groups[0],
				owner: { token: secret },
				items: [{ ...groups[0].items[0], password: secret, icon: { itemType: 1, text: 'NA', token: secret } }],
			},
		]
		const expandedSearch = {
			...defaultSearch,
			token: secret,
			searchEngineList: defaultSearch.searchEngineList.map((engine) => ({ ...engine, password: secret })),
			currentSearchEngine: { ...defaultSearch.currentSearchEngine, token: secret },
		}
		seed({
			...snapshot(),
			token: secret,
			queries: {
				panel: saved(expandedPanel),
				groups: saved(expandedGroups),
				search: saved(expandedSearch),
				auth: saved({ token: secret }),
			},
		})
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		for (const name of ['panel', 'groups', 'search']) {
			expect(queries.getQueryData([name])).toBeDefined()
			expect(JSON.stringify(queries.getQueryData([name]))).not.toContain(secret)
		}
		expect(queries.getQueryData(['auth'])).toBeUndefined()
		queries.setQueryData(['panel'], expandedPanel)
		queries.setQueryData(['groups'], expandedGroups)
		queries.setQueryData(['search'], expandedSearch)
		expect(values.get(HOME_CACHE_KEY)).not.toContain(secret)
		expect(values.get(HOME_CACHE_KEY)).not.toContain('private-user')
	})

	it('replaces saved data with the latest successful save for a later authenticated client', () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		queries.setQueryData(['panel'], { ...panel, panel: { ...panel.panel, logoText: 'First save' } })
		const latest = { ...panel, panel: { ...panel.panel, logoText: 'Latest save' } }
		queries.setQueryData(['panel'], latest)
		const next = client()
		bindHomeCache(next, auth, () => true)
		expect(next.getQueryData(['panel'])).toEqual(latest)
		expect(next.getQueryData(['groups'])).toEqual(groups)
	})

	it('preserves newer memory data when binding and when another query later updates the snapshot', () => {
		seed()
		const queries = client()
		const latest = [{ ...groups[0], title: 'Already saved in this page' }]
		queries.setQueryData(['groups'], latest, { updatedAt: now - 100 })
		bindHomeCache(queries, auth, () => true)
		expect(queries.getQueryData(['groups'])).toEqual(latest)
		expect(persisted().queries.groups).toEqual(saved(latest, now - 100))
		queries.setQueryData(['panel'], { ...panel, panel: { ...panel.panel, logoText: 'Another query saved' } })
		expect(persisted().queries.groups).toEqual(saved(latest, now - 100))
		const next = client()
		bindHomeCache(next, auth, () => true)
		expect(next.getQueryData(['groups'])).toEqual(latest)
		expect(next.getQueryData(['panel'])).toMatchObject({ panel: { logoText: 'Another query saved' } })
	})
})

describe('cache failures and cancellation', () => {
	it('does not replace an existing permission failure without data with an older disk snapshot', async () => {
		seed()
		const queries = client()
		const denied = new ApiError(403, 'Denied before binding')
		await expect(
			queries.fetchQuery({ queryKey: ['groups'], queryFn: () => Promise.reject(denied) }),
		).rejects.toBe(denied)
		expect(queries.getQueryData(['groups'])).toBeUndefined()
		bindHomeCache(queries, auth, () => true)
		expect(queries.getQueryData(['groups'])).toBeUndefined()
		expect(queries.getQueryState(['groups'])?.error).toBe(denied)
		expect(persisted().queries.groups).toBeUndefined()
		queries.setQueryData(['panel'], { ...panel, panel: { ...panel.panel, logoText: 'Unrelated update' } })
		expect(persisted().queries.groups).toBeUndefined()
	})

	it.each([401, 403, 1000, 1001, 1004, 1005, 1006])(
		'removes a cached query rejected by permission code %s',
		async (code) => {
			seed()
			const queries = client()
			bindHomeCache(queries, auth, () => true)
			await expect(
				queries.fetchQuery({ queryKey: ['groups'], queryFn: () => Promise.reject(new ApiError(code, 'Denied')) }),
			).rejects.toMatchObject({ code })
			expect(persisted().queries.groups).toBeUndefined()
			expect(persisted().queries.panel.data).toEqual(panel)
			const next = client()
			bindHomeCache(next, auth, () => true)
			expect(next.getQueryData(['groups'])).toBeUndefined()
		},
	)

	it.each([new Error('Network unavailable'), new ApiError(500, 'Unavailable'), new RequestTimeoutError(15_000)])(
		'preserves useful data after a temporary failure: %s',
		async (error) => {
			seed()
			const before = values.get(HOME_CACHE_KEY)
			const queries = client()
			bindHomeCache(queries, auth, () => true)
			await expect(
				queries.fetchQuery({ queryKey: ['groups'], queryFn: () => Promise.reject(error) }),
			).rejects.toBe(error)
			expect(queries.getQueryData(['groups'])).toEqual(groups)
			expect(values.get(HOME_CACHE_KEY)).toBe(before)
		},
	)

	it('does not persist a late result from a cancelled query', async () => {
		seed()
		const before = values.get(HOME_CACHE_KEY)
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		let finish!: (value: typeof groups) => void
		const result = queries
			.fetchQuery({ queryKey: ['groups'], queryFn: () => new Promise<typeof groups>((resolve) => (finish = resolve)) })
			.catch(() => undefined)
		await queries.cancelQueries({ queryKey: ['groups'], exact: true })
		finish([{ ...groups[0], title: 'Late response' }])
		await result
		await Promise.resolve()
		expect(values.get(HOME_CACHE_KEY)).toBe(before)
		expect(storage.setItem).not.toHaveBeenCalled()
	})

	it('stops writing when the issuing session changes or its binding is stopped', () => {
		const queries = client()
		let active = true
		bindHomeCache(queries, auth, () => active)
		active = false
		queries.setQueryData(['groups'], groups)
		expect(storage.setItem).not.toHaveBeenCalled()
		active = true
		stopHomeCache(queries)
		queries.setQueryData(['panel'], panel)
		expect(storage.setItem).not.toHaveBeenCalled()
	})

	it.each(['malformed', 'wrong-version', 'oversized'])(
		'discards a %s snapshot without breaking network-only operation',
		(kind) => {
			values.set(
				HOME_CACHE_KEY,
				kind === 'malformed'
					? '{broken'
					: kind === 'oversized'
						? 'x'.repeat(512 * 1024 + 1)
						: JSON.stringify({ ...snapshot(), version: 999 }),
			)
			const queries = client()
			expect(() => bindHomeCache(queries, auth, () => true)).not.toThrow()
			expect(queries.getQueryData(['groups'])).toBeUndefined()
			expect(values.has(HOME_CACHE_KEY)).toBe(false)
			queries.setQueryData(['groups'], groups)
			expect(persisted().queries.groups.data).toEqual(groups)
		},
	)

	it('ignores expired, future-dated, and malformed query entries', () => {
		const value = snapshot()
		value.queries.panel.updatedAt = now - HOME_CACHE_MAX_AGE - 1
		value.queries.search.updatedAt = now + 1
		seed({ ...value, queries: { ...value.queries, groups: saved([{ id: 1, items: 'invalid' }]) } })
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		for (const name of ['panel', 'groups', 'search'])
			expect(queries.getQueryData([name])).toBeUndefined()
	})

	it('keeps a valid entry at the age boundary available for revalidation', () => {
		seed({ ...snapshot(), queries: { groups: saved(groups, now - HOME_CACHE_MAX_AGE) } })
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		expect(queries.getQueryData(['groups'])).toEqual(groups)
		expect(queries.getQueryState(['groups'])?.isInvalidated).toBe(true)
	})

	it('continues using memory when storage reads, writes, and removal throw', () => {
		for (const method of [storage.getItem, storage.setItem, storage.removeItem])
			method.mockImplementation(() => {
				throw new Error('Storage denied')
			})
		const queries = client()
		expect(() => bindHomeCache(queries, auth, () => true)).not.toThrow()
		expect(() => queries.setQueryData(['groups'], groups)).not.toThrow()
		expect(queries.getQueryData(['groups'])).toEqual(groups)
		expect(() => clearHomeSnapshot()).not.toThrow()
	})

	it('removes an older snapshot when a successful update is too large to cache', () => {
		seed()
		const queries = client()
		bindHomeCache(queries, auth, () => true)
		const large = [
			{
				...groups[0],
				items: Array.from({ length: 60 }, (_, index) => ({
					...groups[0].items[0],
					id: index + 1,
					description: 'x'.repeat(10000),
				})),
			},
		]
		expect(() => queries.setQueryData(['groups'], large)).not.toThrow()
		expect(queries.getQueryData(['groups'])).toEqual(large)
		expect(values.has(HOME_CACHE_KEY)).toBe(false)
	})
})
