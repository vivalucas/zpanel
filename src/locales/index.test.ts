import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
	const i18n = {
		use: vi.fn(),
		init: vi.fn(),
		hasResourceBundle: vi.fn(),
		addResourceBundle: vi.fn(),
		changeLanguage: vi.fn(),
	}
	return { i18n, german: vi.fn() }
})
vi.mock('i18next', () => ({ default: mocks.i18n }))
vi.mock('react-i18next', () => ({ initReactI18next: {} }))
vi.mock('@/app/store', () => ({ usePreferences: { getState: () => ({ language: 'en-US' }) } }))

beforeEach(() => {
	vi.resetModules()
	vi.clearAllMocks()
	mocks.i18n.use.mockReturnValue(mocks.i18n)
	mocks.i18n.init.mockResolvedValue(undefined)
	mocks.i18n.hasResourceBundle.mockImplementation((language) => ['en-US', 'zh-CN'].includes(language))
	mocks.i18n.changeLanguage.mockReset().mockResolvedValue(undefined)
	mocks.german.mockReset()
	vi.doMock('./de-DE.json', () => mocks.german())
})

it('does not apply a slow translation after a newer language selection', async () => {
	let complete!: (value: { default: Record<string, string> }) => void
	mocks.german.mockImplementation(
		() =>
			new Promise((resolve) => {
				complete = resolve
			}),
	)
	const { setLanguage } = await import('./index')
	const old = setLanguage('de-DE')
	await vi.waitFor(() => expect(mocks.german).toHaveBeenCalledOnce())
	await setLanguage('zh-CN')
	complete({ default: { title: 'Deutsch' } })
	await old
	expect(mocks.i18n.changeLanguage).toHaveBeenCalledExactlyOnceWith('zh-CN')
})

it('does not let an old translation failure replace the newer selection with English', async () => {
	let fail!: (error: Error) => void
	mocks.german.mockImplementation(
		() =>
			new Promise((_, reject) => {
				fail = reject
			}),
	)
	const { setLanguage } = await import('./index')
	const old = setLanguage('de-DE')
	await vi.waitFor(() => expect(mocks.german).toHaveBeenCalledOnce())
	await setLanguage('zh-CN')
	fail(new Error('old chunk unavailable'))
	await old
	expect(mocks.i18n.changeLanguage).toHaveBeenCalledExactlyOnceWith('zh-CN')
})

it('falls back to English when the current translation chunk fails', async () => {
	mocks.german.mockRejectedValue(new Error('chunk unavailable'))
	const { setLanguage } = await import('./index')
	await expect(setLanguage('de-DE')).resolves.toBeUndefined()
	expect(mocks.i18n.changeLanguage).toHaveBeenCalledExactlyOnceWith('en-US')
})

it('handles a current language activation failure with English', async () => {
	mocks.i18n.changeLanguage.mockRejectedValueOnce(new Error('activation failed'))
	const { setLanguage } = await import('./index')
	await expect(setLanguage('zh-CN')).resolves.toBeUndefined()
	expect(mocks.i18n.changeLanguage.mock.calls.map(([language]) => language)).toEqual(['zh-CN', 'en-US'])
})
