import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ german: vi.fn() }))

beforeEach(() => {
	vi.resetModules()
	mocks.german.mockReset().mockResolvedValue({ default: { locale: 'de' } })
	vi.doMock('antd/locale/de_DE', () => mocks.german())
})

it('loads only a requested locale and retains English for unknown languages', async () => {
	const { cachedAntdLocale, loadAntdLocale } = await import('./antdLocale')
	expect((await loadAntdLocale('en-US')).locale).toBe('en')
	expect((await loadAntdLocale('unknown')).locale).toBe('en')
	expect((await loadAntdLocale('constructor')).locale).toBe('en')
	expect(cachedAntdLocale('de-DE').locale).toBe('en')
	expect(mocks.german).not.toHaveBeenCalled()
	expect((await loadAntdLocale('de-DE')).locale).toBe('de')
	expect(cachedAntdLocale('de-DE').locale).toBe('de')
	expect(mocks.german).toHaveBeenCalledTimes(1)
})

it('shares a pending locale import across consumers', async () => {
	let complete!: (value: { default: { locale: string } }) => void
	mocks.german.mockImplementation(
		() =>
			new Promise((resolve) => {
				complete = resolve
			}),
	)
	const { loadAntdLocale } = await import('./antdLocale')
	const first = loadAntdLocale('de-DE')
	const second = loadAntdLocale('de-DE')
	expect(first).toBe(second)
	await vi.waitFor(() => expect(mocks.german).toHaveBeenCalledTimes(1))
	complete({ default: { locale: 'de' } })
	await expect(first).resolves.toEqual({ locale: 'de' })
})

it('handles a failed locale chunk with the bundled English fallback', async () => {
	mocks.german.mockRejectedValue(new Error('chunk unavailable'))
	const { cachedAntdLocale, loadAntdLocale } = await import('./antdLocale')
	await expect(loadAntdLocale('de-DE')).resolves.toMatchObject({ locale: 'en' })
	expect(cachedAntdLocale('de-DE').locale).toBe('en')
})

it.each([
	['zh-CN', 'zh-cn'],
	['zh-TW', 'zh-tw'],
	['es-ES', 'es'],
	['fr-FR', 'fr'],
	['it-IT', 'it'],
	['ja-JP', 'ja'],
	['ko-KR', 'ko'],
	['pt-BR', 'pt-br'],
	['ru-RU', 'ru'],
])('loads the Ant Design locale for %s', async (language, expected) => {
	const { loadAntdLocale } = await import('./antdLocale')
	expect((await loadAntdLocale(language)).locale).toBe(expected)
})
