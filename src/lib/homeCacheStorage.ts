export const HOME_CACHE_KEY = 'zpanel-home-cache'
export const HOME_CACHE_MAX_AGE = 24 * 60 * 60 * 1000

export function clearHomeSnapshot() {
	try {
		localStorage.removeItem(HOME_CACHE_KEY)
	} catch {
		// Storage may be unavailable. Network-only operation remains available.
	}
}
