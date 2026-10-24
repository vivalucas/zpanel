import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { isAccessError } from './queryState'

describe('isAccessError', () => {
	it.each([401, 403, 1000, 1001, 1004, 1005, 1006])('blocks cached content for access error %s', (code) => {
		expect(isAccessError(new ApiError(code, 'Denied'))).toBe(true)
	})
	it.each([500, 502, 1202])('allows the page to retain cached content for temporary error %s', (code) => {
		expect(isAccessError(new ApiError(code, 'Unavailable'))).toBe(false)
	})
	it('does not confuse network or cancelled requests with denied access', () => {
		expect(isAccessError(new TypeError('Failed to fetch'))).toBe(false)
		expect(isAccessError(new DOMException('Cancelled', 'AbortError'))).toBe(false)
		expect(isAccessError(null)).toBe(false)
	})
})
