import type { QueryClient } from '@tanstack/react-query'
import type { AuthInfo } from './api'
import { isValidPanelConfig } from './panelConfig'
import { isAccessError } from './queryState'
import { clearHomeSnapshot, HOME_CACHE_KEY, HOME_CACHE_MAX_AGE } from './homeCacheStorage'

const maximumCharacters = 512 * 1024
const names = ['panel', 'groups', 'search'] as const
export type HomeQueryName = (typeof names)[number]
type Name = HomeQueryName
interface SavedQuery {
	data: unknown
	updatedAt: number
}
interface Snapshot {
	version: 1
	userId: number
	role: number
	queries: Partial<Record<Name, SavedQuery>>
}
interface Binding {
	userId: number
	role: number
	unverified: Set<Name>
	stop: () => void
}
const bindings = new WeakMap<QueryClient, Binding>()
const verificationListeners = new WeakMap<QueryClient, Set<() => void>>()

function notifyVerification(client: QueryClient) {
	verificationListeners.get(client)?.forEach((listener) => listener())
}
export function subscribeHomeVerification(client: QueryClient, listener: () => void) {
	const listeners = verificationListeners.get(client) || new Set<() => void>()
	verificationListeners.set(client, listeners)
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
		if (!listeners.size) verificationListeners.delete(client)
	}
}

function object(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}
function text(value: unknown, maximum = 2048) {
	return typeof value === 'string' && value.length <= maximum
}
function optionalText(value: unknown, maximum = 2048) {
	return value === undefined || text(value, maximum)
}
function identifier(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
function optionalNumber(value: unknown) {
	return value === undefined || (typeof value === 'number' && Number.isFinite(value))
}
function engine(value: unknown) {
	return object(value) && text(value.title, 200) && text(value.url) && optionalText(value.iconSrc)
}
function icon(value: unknown) {
	return (
		value == null ||
		(object(value) &&
			typeof value.itemType === 'number' &&
			[1, 2, 3].includes(value.itemType) &&
			optionalText(value.src) &&
			optionalText(value.text, 200) &&
			optionalText(value.backgroundColor, 200))
	)
}
function item(value: unknown) {
	return (
		object(value) &&
		identifier(value.id) &&
		text(value.title, 200) &&
		text(value.url) &&
		optionalText(value.lanUrl) &&
		optionalText(value.description, 10000) &&
		optionalNumber(value.sort) &&
		(value.itemIconGroupId === undefined || identifier(value.itemIconGroupId)) &&
		typeof value.openMethod === 'number' &&
		[1, 2, 3].includes(value.openMethod) &&
		icon(value.icon)
	)
}
function validData(name: Name, data: unknown): boolean {
	if (name === 'panel')
		return (
			object(data) &&
			isValidPanelConfig(data.panel) &&
			object(data.panel) &&
			['px', '%'].includes(String(data.panel.maxWidthUnit)) &&
			Array.isArray(data.panelWarnings) &&
			data.panelWarnings.every((warning) => text(warning, 200))
		)
	if (name === 'search')
		return (
			object(data) &&
			Array.isArray(data.searchEngineList) &&
			data.searchEngineList.length <= 100 &&
			data.searchEngineList.every(engine) &&
			engine(data.currentSearchEngine) &&
			typeof data.newWindowOpen === 'boolean'
		)
	return (
		Array.isArray(data) &&
		data.length <= 1000 &&
		data.every(
			(group) =>
				object(group) &&
				identifier(group.id) &&
				optionalText(group.title, 200) &&
				optionalNumber(group.sort) &&
				Array.isArray(group.items) &&
				group.items.length <= 10000 &&
				group.items.every(item),
		)
	)
}

function pick(value: Record<string, unknown>, fields: readonly string[]) {
	return Object.fromEntries(
		fields.filter((field) => Object.hasOwn(value, field)).map((field) => [field, value[field]]),
	)
}
const panelFields: (keyof Panel.panelConfig)[] = [
	'backgroundImageSrc',
	'backgroundBlur',
	'backgroundMaskNumber',
	'wallpaperAutoContrast',
	'iconStyle',
	'iconTextColor',
	'iconTextInfoHideDescription',
	'iconTextIconHideTitle',
	'logoText',
	'logoImageSrc',
	'clockShowSecond',
	'clockColor',
	'searchBoxShow',
	'searchBoxSearchIcon',
	'marginTop',
	'marginBottom',
	'maxWidth',
	'maxWidthUnit',
	'marginX',
	'footerHtml',
	'systemMonitorShow',
	'systemMonitorShowTitle',
	'systemMonitorPublicVisitModeShow',
	'netModeChangeButtonShow',
]
// Persist only display fields. Extra response properties must not expand the cache contract.
function displayData(name: Name, data: unknown): unknown {
	if (name === 'panel') {
		const value = data as Record<string, unknown>
		return {
			panel: pick(value.panel as Record<string, unknown>, panelFields),
			panelWarnings: value.panelWarnings,
		}
	}
	if (name === 'search') {
		const value = data as Record<string, unknown>
		const fields = ['title', 'url', 'iconSrc']
		return {
			searchEngineList: (value.searchEngineList as Record<string, unknown>[]).map((entry) =>
				pick(entry, fields),
			),
			currentSearchEngine: pick(value.currentSearchEngine as Record<string, unknown>, fields),
			newWindowOpen: value.newWindowOpen,
		}
	}
	return (data as Record<string, unknown>[]).map((group) => ({
		...pick(group, ['id', 'title', 'sort']),
		items: (group.items as Record<string, unknown>[]).map((entry) => ({
			...pick(entry, [
				'id',
				'title',
				'url',
				'lanUrl',
				'description',
				'openMethod',
				'sort',
				'itemIconGroupId',
			]),
			icon: object(entry.icon) ? pick(entry.icon, ['itemType', 'src', 'text', 'backgroundColor']) : null,
		})),
	}))
}

function readSnapshot(userId: number, role: number): Snapshot | undefined {
	try {
		const raw = localStorage.getItem(HOME_CACHE_KEY)
		if (!raw) return
		if (raw.length > maximumCharacters) throw new Error('Oversized home snapshot')
		const value: unknown = JSON.parse(raw)
		if (!object(value) || value.version !== 1 || !object(value.queries))
			throw new Error('Invalid home snapshot')
		if (value.userId !== userId || value.role !== role) return
		const queries: Snapshot['queries'] = {}
		for (const name of names) {
			const saved = value.queries[name]
			if (
				object(saved) &&
				typeof saved.updatedAt === 'number' &&
				Number.isFinite(saved.updatedAt) &&
				saved.updatedAt > 0 &&
				saved.updatedAt <= Date.now() &&
				Date.now() - saved.updatedAt <= HOME_CACHE_MAX_AGE &&
				validData(name, saved.data)
			)
				queries[name] = { data: displayData(name, saved.data), updatedAt: saved.updatedAt }
		}
		return { version: 1, userId, role, queries }
	} catch {
		clearHomeSnapshot()
	}
}
function writeSnapshot(snapshot: Snapshot) {
	try {
		const raw = JSON.stringify(snapshot)
		if (raw.length <= maximumCharacters) localStorage.setItem(HOME_CACHE_KEY, raw)
		else clearHomeSnapshot()
	} catch {
		// A failed cache write must not fail an otherwise successful query or save.
	}
}

export function stopHomeCache(client: QueryClient) {
	bindings.get(client)?.stop()
	bindings.delete(client)
	notifyVerification(client)
}

export function discardHomeCache(client: QueryClient) {
	stopHomeCache(client)
	for (const name of names) client.removeQueries({ queryKey: [name], exact: true })
	clearHomeSnapshot()
}

export function isUnverifiedHomeData(client: QueryClient, name: Name) {
	return bindings.get(client)?.unverified.has(name) || false
}

// Settings must read current server values before an old display snapshot can enter a form.
export function clearUnverifiedHomeData(client: QueryClient) {
	const binding = bindings.get(client)
	if (!binding) return
	for (const name of binding.unverified) client.removeQueries({ queryKey: [name], exact: true })
	binding.unverified.clear()
	notifyVerification(client)
}

// Called only after a fresh server authentication. Authentication and public-site data
// are never restored. A single bounded snapshot contains no tokens or user profile.
export function bindHomeCache(
	client: QueryClient,
	auth: AuthInfo,
	currentSession: () => boolean,
	restore = true,
) {
	if (!currentSession()) return
	const userId = auth.user?.id
	const role = auth.user?.role
	const previous = bindings.get(client)
	if (auth.visitMode !== 0 || !identifier(userId) || !identifier(role)) {
		if (previous) discardHomeCache(client)
		else stopHomeCache(client)
		return
	}
	if (previous?.userId === userId && previous.role === role) return
	stopHomeCache(client)
	// An identity or role change in the same document cannot retain an older scope.
	if (previous) {
		for (const name of names) client.removeQueries({ queryKey: [name], exact: true })
		clearHomeSnapshot()
	}
	const snapshot = readSnapshot(userId, role) || {
		version: 1 as const,
		userId,
		role,
		queries: {},
	}
	const unverified = new Set<Name>()
	let capturedMemory = false
	for (const name of names) {
		const current = client.getQueryState([name])
		if (isAccessError(current?.error)) {
			delete snapshot.queries[name]
			capturedMemory = true
			continue
		}
		if (current?.data !== undefined) {
			if (validData(name, current.data)) {
				snapshot.queries[name] = {
					data: displayData(name, current.data),
					updatedAt: current.dataUpdatedAt,
				}
			}
			capturedMemory = true
			continue
		}
		const saved = snapshot.queries[name]
		if (!restore || !saved) continue
		unverified.add(name)
		client.setQueryData([name], saved.data, { updatedAt: saved.updatedAt })
		// Even a snapshot written seconds ago must validate permissions and data on mount.
		void client.invalidateQueries({ queryKey: [name], exact: true, refetchType: 'none' })
	}
	if (capturedMemory) writeSnapshot(snapshot)
	const stop = client.getQueryCache().subscribe((event) => {
		if (!currentSession() || event.type !== 'updated' || event.query.queryKey.length !== 1) return
		const name = event.query.queryKey[0] as Name
		if (!names.includes(name)) return
		if (event.action.type === 'error' && isAccessError(event.query.state.error)) {
			delete snapshot.queries[name]
			writeSnapshot(snapshot)
		} else if (event.action.type === 'success') {
			if (!event.action.manual && unverified.delete(name)) notifyVerification(client)
			const { data, dataUpdatedAt } = event.query.state
			if (validData(name, data)) {
				snapshot.queries[name] = { data: displayData(name, data), updatedAt: dataUpdatedAt }
				writeSnapshot(snapshot)
			}
		}
	})
	bindings.set(client, { userId, role, unverified, stop })
	notifyVerification(client)
}
