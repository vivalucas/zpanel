import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	fetchGroups,
	fetchPanel,
	getModule,
	READ_REQUEST_TIMEOUT_MS,
	request,
	RequestTimeoutError,
	saveModule,
	uploadImage,
} from './api'
const state = vi.hoisted(() => ({
	token: 'current-token' as string | null,
	language: 'zh-CN',
	forgetAccount: vi.fn(),
}))
vi.mock('@/app/store', () => ({ usePreferences: { getState: () => state } }))
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	vi.clearAllMocks()
	state.token = 'current-token'
})
function response(code: number, data: unknown = null) {
	return new Response(JSON.stringify({ code, data, msg: 'backend message' }), { status: 200 })
}
describe('aPI contract and session boundaries', () => {
	it('loads the full navigation snapshot with a single cancellable request', async () => {
		const groups = [{ id: 1, title: 'Apps', items: [{ id: 2, title: 'NAS' }] }]
		const fetch = vi.fn().mockResolvedValue(response(0, groups))
		vi.stubGlobal('fetch', fetch)
		await expect(fetchGroups()).resolves.toEqual(groups)
		expect(fetch).toHaveBeenCalledTimes(1)
		expect(fetch.mock.calls[0][0]).toBe('/api/panel/itemIconGroup/getNavigation')
	})
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
		state.forgetAccount.mockImplementationOnce(() => {
			state.token = null
		})
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
	it('discards explicit anonymous login results if the issuing session has changed', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async () => {
				state.token = 'another-account'
				return response(0, { token: 'late-login' })
			}),
		)
		await expect(request('/login', {}, { token: null, sessionToken: 'current-token' })).rejects.toMatchObject(
			{ name: 'AbortError' },
		)
	})
	it('does not start a request after its page lifetime has ended', async () => {
		const fetch = vi.fn()
		vi.stubGlobal('fetch', fetch)
		const controller = new AbortController()
		controller.abort()
		await expect(request('/delete', {}, { signal: controller.signal })).rejects.toMatchObject({
			name: 'AbortError',
		})
		expect(fetch).not.toHaveBeenCalled()
	})
	it('discards response bodies which finish decoding after page cancellation', async () => {
		const controller = new AbortController()
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => {
					controller.abort()
					return { code: 0, data: { title: 'Late response' } }
				},
			}),
		)
		await expect(request('/read', {}, { signal: controller.signal })).rejects.toMatchObject({
			name: 'AbortError',
		})
		expect(state.forgetAccount).not.toHaveBeenCalled()
	})
})

function pendingUntilAbort(signal: AbortSignal) {
	return new Promise<never>((_resolve, reject) => {
		signal.addEventListener('abort', () => reject(signal.reason), { once: true })
	})
}

describe('explicit read request deadlines', () => {
	it('aborts a request with no response and reports a distinct timeout', async () => {
		vi.useFakeTimers()
		let signal: AbortSignal | undefined
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, options: RequestInit) => {
				signal = options.signal!
				return pendingUntilAbort(signal)
			}),
		)
		const result = request('/read', {}, { timeoutMs: 100 }).catch((error: unknown) => error)
		await vi.advanceTimersByTimeAsync(99)
		expect(signal?.aborted).toBe(false)
		await vi.advanceTimersByTimeAsync(1)
		await expect(result).resolves.toBeInstanceOf(RequestTimeoutError)
		await expect(result).resolves.toMatchObject({ name: 'TimeoutError', timeoutMs: 100 })
		expect(signal?.aborted).toBe(true)
		expect(signal?.reason).toBe(await result)
		expect(vi.getTimerCount()).toBe(0)
		expect(state.forgetAccount).not.toHaveBeenCalled()
	})

	it('keeps the deadline active while reading a streaming JSON body', async () => {
		vi.useFakeTimers()
		let signal: AbortSignal | undefined
		const json = vi.fn(() => pendingUntilAbort(signal!))
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, options: RequestInit) => {
				signal = options.signal!
				return Promise.resolve({ ok: true, json })
			}),
		)
		const result = request('/read', {}, { timeoutMs: 100 }).catch((error: unknown) => error)
		await vi.advanceTimersByTimeAsync(0)
		expect(json).toHaveBeenCalledTimes(1)
		expect(signal?.aborted).toBe(false)
		await vi.advanceTimersByTimeAsync(100)
		await expect(result).resolves.toBeInstanceOf(RequestTimeoutError)
		expect(signal?.aborted).toBe(true)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('closes a real streaming HTTP response when its read deadline expires', async () => {
		const nativeFetch = globalThis.fetch
		let bodyClosed!: () => void
		const closed = new Promise<void>((resolve) => {
			bodyClosed = resolve
		})
		const server = createServer((_request, result) => {
			result.on('close', bodyClosed)
			result.writeHead(200, { 'Content-Type': 'application/json' })
			result.write('{"code":0,"data":')
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		try {
			const address = server.address()
			if (!address || typeof address === 'string') throw new Error('Missing test HTTP address')
			let headersReceived!: () => void
			const headers = new Promise<void>((resolve) => {
				headersReceived = resolve
			})
			vi.stubGlobal(
				'fetch',
				vi.fn(async (url: string, options: RequestInit) => {
					const response = await nativeFetch(new URL(url, `http://127.0.0.1:${address.port}`), options)
					headersReceived()
					return response
				}),
			)
			const result = request('/read', {}, { timeoutMs: 1000 }).catch((error: unknown) => error)
			await headers
			await expect(result).resolves.toBeInstanceOf(RequestTimeoutError)
			await closed
		} finally {
			server.closeAllConnections()
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			)
		}
	})

	it('forwards caller cancellation without reclassifying it as a timeout', async () => {
		vi.useFakeTimers()
		const caller = new AbortController()
		let signal: AbortSignal | undefined
		const removeListener = vi.spyOn(caller.signal, 'removeEventListener')
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, options: RequestInit) => {
				signal = options.signal!
				return pendingUntilAbort(signal)
			}),
		)
		const result = request('/read', {}, { signal: caller.signal, timeoutMs: 100 }).catch(
			(error: unknown) => error,
		)
		const reason = new Error('Page closed')
		caller.abort(reason)
		await expect(result).resolves.toMatchObject({ name: 'AbortError' })
		expect(await result).not.toBeInstanceOf(RequestTimeoutError)
		expect(signal?.aborted).toBe(true)
		expect(signal?.reason).toBe(reason)
		expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
		expect(vi.getTimerCount()).toBe(0)
		await vi.advanceTimersByTimeAsync(100)
		expect(signal?.reason).toBe(reason)
	})

	it('does not start a timed read after caller cancellation', async () => {
		vi.useFakeTimers()
		const fetch = vi.fn()
		vi.stubGlobal('fetch', fetch)
		const controller = new AbortController()
		controller.abort()
		await expect(request('/read', {}, { signal: controller.signal, timeoutMs: 100 })).rejects.toMatchObject({
			name: 'AbortError',
		})
		expect(fetch).not.toHaveBeenCalled()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('cleans up the deadline and caller listener after success', async () => {
		vi.useFakeTimers()
		const caller = new AbortController()
		const removeListener = vi.spyOn(caller.signal, 'removeEventListener')
		let signal: AbortSignal | undefined
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, options: RequestInit) => {
				signal = options.signal!
				return Promise.resolve(response(0, { title: 'Ready' }))
			}),
		)
		await expect(request('/read', {}, { signal: caller.signal, timeoutMs: 100 })).resolves.toEqual({
			title: 'Ready',
		})
		expect(vi.getTimerCount()).toBe(0)
		expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
		caller.abort()
		await vi.advanceTimersByTimeAsync(100)
		expect(signal?.aborted).toBe(false)
	})

	it.each(['fetch', 'json'])('cleans up after a %s failure', async (stage) => {
		vi.useFakeTimers()
		const failure = new Error('Read failed')
		const fetch =
			stage === 'fetch'
				? vi.fn().mockRejectedValue(failure)
				: vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(failure) })
		vi.stubGlobal('fetch', fetch)
		await expect(request('/read', {}, { timeoutMs: 100 })).rejects.toBe(failure)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('keeps a changed session cancelled when its outstanding read reaches the deadline', async () => {
		vi.useFakeTimers()
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, options: RequestInit) => pendingUntilAbort(options.signal!)),
		)
		const result = request('/read', {}, { timeoutMs: 100 }).catch((error: unknown) => error)
		state.token = 'new-token'
		await vi.advanceTimersByTimeAsync(100)
		await expect(result).resolves.toMatchObject({ name: 'AbortError', message: 'Session changed' })
		expect(state.forgetAccount).not.toHaveBeenCalled()
	})

	it('applies the shared budget to navigation, appearance, and module reads', async () => {
		vi.useFakeTimers()
		vi.stubGlobal(
			'fetch',
			vi.fn((_url: string, options: RequestInit) => pendingUntilAbort(options.signal!)),
		)
		const results = [fetchGroups(), fetchPanel(), getModule('deskModuleSearchBox')].map((promise) =>
			promise.catch((error: unknown) => error),
		)
		await vi.advanceTimersByTimeAsync(READ_REQUEST_TIMEOUT_MS)
		for (const result of results) {
			await expect(result).resolves.toBeInstanceOf(RequestTimeoutError)
			await expect(result).resolves.toMatchObject({ timeoutMs: READ_REQUEST_TIMEOUT_MS })
		}
		expect(vi.getTimerCount()).toBe(0)
	})

	it('never imposes a deadline or retry on uploads, saves, and deletes', async () => {
		vi.useFakeTimers()
		const finish: ((value: Response) => void)[] = []
		const fetch = vi.fn(
			(_url: string, _options: RequestInit) => new Promise<Response>((resolve) => finish.push(resolve)),
		)
		vi.stubGlobal('fetch', fetch)
		let settled = 0
		const writes = [
			uploadImage(new Blob(['image'])),
			saveModule('search', { title: 'Saved' }),
			request('/panel/itemIcon/deletes', { ids: [1] }),
		].map((promise) => promise.then(() => settled++))
		await vi.advanceTimersByTimeAsync(READ_REQUEST_TIMEOUT_MS * 2)
		expect(settled).toBe(0)
		expect(vi.getTimerCount()).toBe(0)
		expect(fetch).toHaveBeenCalledTimes(3)
		for (const call of fetch.mock.calls) expect(call[1]?.signal).toBeUndefined()
		for (const resolve of finish) resolve(response(0))
		await Promise.all(writes)
		expect(settled).toBe(3)
	})
})
