import { expect, it, vi, afterEach } from 'vitest'
import { randomId } from './id'
afterEach(() => vi.unstubAllGlobals())
it('creates valid unique UUIDs without the HTTPS-only randomUUID API', () => {
	const getRandomValues = crypto.getRandomValues.bind(crypto)
	vi.stubGlobal('crypto', { getRandomValues })
	const ids = Array.from({ length: 100 }, randomId)
	expect(new Set(ids).size).toBe(100)
	for (const id of ids) expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/)
})
