import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGroups, fetchPanel, request } from './api'
const state = vi.hoisted(() => ({
	token: 'current-token' as string | null,
	language: 'zh-CN',
	forgetAccount: vi.fn(),
}))
vi.mock('@/app/store', () => ({ usePreferences: { getState: () => state } }))
afterEach(() => {
	vi.unstubAllGlobals()
	vi.clearAllMocks()
	state.token = 'current-token'
})
function response(code: number, data: unknown = null) {
	return new Response(JSON.stringify({ code, data, msg: 'backend message' }), { status: 200 })
}
describe('aPI contract and session boundaries', () => {
	it('sends current authentication, language, and cancellation signal', async () => {
		const fetch = vi.fn().mockResolvedValue(response(0, { id: 1 }))
		vi.stubGlobal('fetch', fetch)
		const signal = new AbortController().signal
		await expect(request('/test', { value: 1 }, { signal })).resolves.toEqual({ id: 1 })
		expect(fetch).toHaveBeenCalledWith(
			'/api/test',
			expect.objectContaining({
				signal,
				headers: expect.objectContaining({ token: 'current-token', lang: 'zh-cn' }),
				body: JSON.stringify({ value: 1 }),
			}),
		)
	})
	it('rejects business errors even when HTTP status is successful', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(1005)))
		await expect(request('/test')).rejects.toMatchObject({ code: 1005 })
		expect(state.forgetAccount).not.toHaveBeenCalled()
	})
	it('expires only the session which issued the request', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async () => {
				state.token = 'new-token'
				return response(1001)
			}),
		)
		await expect(request('/test')).rejects.toMatchObject({ name: 'AbortError' })
		expect(state.forgetAccount).not.toHaveBeenCalled()
	})
	it('clears a rejected current session', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(1001)))
		await expect(request('/test')).rejects.toMatchObject({ code: 1001 })
		expect(state.forgetAccount).toHaveBeenCalledWith('current-token')
	})
	it('does not attach a session to explicit anonymous login', async () => {
		const fetch = vi.fn().mockResolvedValue(response(0))
		vi.stubGlobal('fetch', fetch)
		await request('/login', {}, { token: null })
		expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('token')
	})
	it('uses defaults only for an absent config, never for a database failure', async () => {
		const fetch = vi.fn().mockResolvedValueOnce(response(1202)).mockResolvedValueOnce(response(1200))
		vi.stubGlobal('fetch', fetch)
		expect((await fetchPanel()).panel.logoText).toBe('ZPanel')
		await expect(fetchPanel()).rejects.toMatchObject({ code: 1200 })
	})
	it('does not read another account after a group-list response races a switch', async () => {
		const fetch = vi.fn().mockImplementation(async () => {
			state.token = 'new-token'
			return response(0, { list: [{ id: 1, title: 'Private' }] })
		})
		vi.stubGlobal('fetch', fetch)
		await expect(fetchGroups()).rejects.toMatchObject({ name: 'AbortError' })
		expect(fetch).toHaveBeenCalledTimes(1)
	})
	it('rejects a stale modal action before sending it under a new account', async () => {
		const fetch = vi.fn()
		vi.stubGlobal('fetch', fetch)
		await expect(request('/delete', {}, { sessionToken: 'previous-token' })).rejects.toMatchObject({
			name: 'AbortError',
		})
		expect(fetch).not.toHaveBeenCalled()
	})
})
