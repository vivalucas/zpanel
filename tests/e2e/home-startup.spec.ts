import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function gate() {
	let release!: () => void
	const waiting = new Promise<void>((resolve) => {
		release = resolve
	})
	return { waiting, release }
}

async function fixture(page: Page, cached = false, theme: 'light' | 'dark' = 'light') {
	const state = {
		authCode: 0,
		authReads: 0,
		authCompleted: 0,
		privateReads: [] as string[],
		authGate: undefined as ReturnType<typeof gate> | undefined,
		panelGate: undefined as ReturnType<typeof gate> | undefined,
	}
	await page.addInitScript(
		({ seedCache, theme }) => {
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: 'startup-fixture',
						accounts: [],
						language: 'zh-CN',
						theme,
						network: 'wan',
						homeEditHintDismissed: true,
					},
				}),
			)
			if (seedCache) {
				const saved = (data: unknown) => ({ data, updatedAt: Date.now() - 1000 })
				const engine = { title: 'Private cached search', url: 'https://private-cache.example.test/?q=%s' }
				localStorage.setItem(
					'zpanel-home-cache',
					JSON.stringify({
						version: 1,
						userId: 7800,
						role: 2,
						queries: {
							panel: saved({
								panel: {
									logoText: 'Private cached home',
									maxWidthUnit: 'px',
									searchBoxShow: true,
									footerHtml: '',
								},
								panelWarnings: [],
							}),
							groups: saved([
								{
									id: 7800,
									title: 'Private cached group',
									items: [
										{ id: 7801, title: 'Private cached app', url: '/favicon.svg', openMethod: 2, icon: null },
									],
								},
							]),
							search: saved({ searchEngineList: [engine], currentSearchEngine: engine, newWindowOpen: true }),
						},
					}),
				)
			}
			const trackingWindow = window as Window & { __startupCacheReads?: number }
			trackingWindow.__startupCacheReads = 0
			const read = Storage.prototype.getItem
			Storage.prototype.getItem = function (key: string) {
				if (key === 'zpanel-home-cache') trackingWindow.__startupCacheReads!++
				return read.call(this, key)
			}
		},
		{ seedCache: cached, theme },
	)
	await page.route('**/api/**', async (route) => {
		const path = new URL(route.request().url()).pathname
		let data: unknown = null
		let code = 0
		if (path === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		else if (path === '/api/user/getAuthInfo') {
			state.authReads++
			await state.authGate?.waiting
			code = state.authCode
			data = { user: { id: 7800, role: 2 }, visitMode: 0 }
		} else {
			state.privateReads.push(path)
			if (path === '/api/panel/userConfig/get') {
				await state.panelGate?.waiting
				data = {
					panel: { logoText: 'Authorized home', footerHtml: '', searchBoxShow: true },
					panelWarnings: [],
				}
			} else if (path === '/api/panel/itemIconGroup/getNavigation') {
				data = [
					{
						id: 7800,
						title: 'Authorized group',
						items: [
							{
								id: 7801,
								title: 'Authorized app',
								url: '/favicon.svg',
								openMethod: 2,
								icon: { itemType: 1, text: 'A' },
							},
						],
					},
				]
			}
		}
		await route.fulfill({ json: { code, data, msg: 'Startup fixture response' } })
		if (path === '/api/user/getAuthInfo') state.authCompleted++
	})
	return state
}

async function expectPublicShell(page: Page) {
	const shell = page.locator('.home-startup-shell')
	await expect(shell).toBeVisible()
	await expect(shell.locator('.home-logo-text')).toHaveText('ZPanel')
	await expect(shell.locator('.clock time')).toHaveText(/\d{2}:\d{2}/)
	await expect(shell.locator('input, button, a')).toHaveCount(0)
	await expect(page.locator('.home-page')).toHaveCount(0)
	return shell
}

async function expectNoPrivateContent(page: Page) {
	await expect(page.getByRole('link', { name: 'Private cached app', exact: true })).toHaveCount(0)
	await expect(page.getByText('Private cached home', { exact: true })).toHaveCount(0)
	await expect(page.getByText('Private cached search', { exact: true })).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Authorized app', exact: true })).toHaveCount(0)
}

test('the initial home shows a live public clock without reading private data or its saved snapshot', async ({
	page,
}, info) => {
	await page.clock.install({ time: new Date('2026-10-27T01:02:00Z') })
	const state = await fixture(page, true)
	state.authGate = gate()
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		const shell = await expectPublicShell(page)
		await expect(shell.getByRole('status')).toContainText('正在验证身份…')
		await expectNoPrivateContent(page)
		expect(state.privateReads).toEqual([])
		expect(
			await page.evaluate(() => (window as Window & { __startupCacheReads?: number }).__startupCacheReads),
		).toBe(0)
		const clock = shell.locator('.clock time')
		const previous = await clock.textContent()
		await page.clock.setSystemTime(new Date('2026-10-27T01:03:00Z'))
		await page.clock.runFor(1000)
		await expect(clock).not.toHaveText(previous!)
		await expect(clock).toHaveAttribute('datetime', /2026-10-27T01:03:0\d/)
		await page.screenshot({ path: info.outputPath('home-public-startup-shell.png'), animations: 'disabled' })
		state.authGate.release()
		await expect(page.getByRole('link', { name: 'Authorized app', exact: true })).toBeVisible()
		await expect(shell).toHaveCount(0)
	} finally {
		state.authGate.release()
	}
})

test('the public shell remains while authenticated home code is still downloading', async ({ page }) => {
	const state = await fixture(page)
	const code = gate()
	let codeRequested = false
	await page.route('**/assets/Home-*.js', async (route) => {
		codeRequested = true
		await code.waiting
		await route.continue()
	})
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expect.poll(() => codeRequested).toBe(true)
		await expect.poll(() => state.authCompleted).toBe(1)
		await expectPublicShell(page)
		expect(state.privateReads).toEqual([])
		code.release()
		await expect(page.getByRole('link', { name: 'Authorized app', exact: true })).toBeVisible()
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
	} finally {
		code.release()
	}
})

for (const failure of ['404', 'network'] as const) {
	test(`failed home code (${failure}) keeps a live public shell and recovers after refresh`, async ({
		page,
	}, info) => {
		await page.clock.install({ time: new Date('2026-10-27T01:02:00Z') })
		if (failure === 'network') await page.setViewportSize({ width: 320, height: 640 })
		const state = await fixture(page, true, failure === 'network' ? 'dark' : 'light')
		state.authGate = gate()
		let failCode = true
		let codeRequests = 0
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		await page.route('**/assets/Home-*.js', async (route) => {
			codeRequests++
			if (!failCode) return route.continue()
			if (failure === 'network') return route.abort('failed')
			return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing chunk' })
		})
		try {
			await page.goto('/#/', { waitUntil: 'domcontentloaded' })
			await expect.poll(() => codeRequests).toBeGreaterThan(0)
			const shell = await expectPublicShell(page)
			await expect(shell.getByRole('status')).toContainText('正在验证身份…')
			await expectNoPrivateContent(page)
			expect(state.privateReads).toEqual([])
			state.authGate.release()
			await expect(shell.getByRole('alert')).toBeVisible()
			const refresh = shell.getByRole('button', { name: '刷新页面', exact: true })
			await expect(refresh).toBeVisible()
			await expect(shell.locator('.clock time')).toBeVisible()
			await expect(page.getByText('修复外观配置', { exact: true })).toHaveCount(0)
			await expectNoPrivateContent(page)
			expect(state.privateReads).toEqual([])
			const before = await shell.locator('.clock time').textContent()
			await page.clock.setSystemTime(new Date('2026-10-27T01:03:00Z'))
			await page.clock.runFor(1000)
			await expect(shell.locator('.clock time')).not.toHaveText(before!)
			expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
			await page.screenshot({ path: info.outputPath(`home-code-${failure}.png`), animations: 'disabled' })
			failCode = false
			await refresh.click()
			await expect(page.getByRole('link', { name: 'Authorized app', exact: true })).toBeVisible()
			await expect(shell).toHaveCount(0)
			expect(state.authCompleted).toBe(2)
			expect(codeRequests).toBeGreaterThan(1)
			expect(errors).toEqual([])
		} finally {
			state.authGate.release()
		}
	})
}

test('the public shell remains until the authenticated appearance request completes', async ({ page }) => {
	const state = await fixture(page)
	state.panelGate = gate()
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expect.poll(() => state.privateReads.includes('/api/panel/userConfig/get')).toBe(true)
		await expectPublicShell(page)
		await expectNoPrivateContent(page)
		state.panelGate.release()
		await expect(page.locator('.home-page .home-logo-text')).toHaveText('Authorized home')
		await expect(page.getByRole('link', { name: 'Authorized app', exact: true })).toBeVisible()
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
	} finally {
		state.panelGate.release()
	}
})

test('a temporary authentication failure keeps the clock and offers a guarded retry inside the shell', async ({
	page,
}) => {
	const state = await fixture(page, true)
	state.authCode = 500
	try {
		await page.goto('/#/')
		const shell = page.locator('.home-startup-shell')
		await expect(shell.locator('.clock time')).toBeVisible()
		await expect(shell.getByRole('button', { name: '重试', exact: true })).toBeVisible()
		await expectNoPrivateContent(page)
		expect(state.privateReads).toEqual([])
		expect(
			await page.evaluate(() => (window as Window & { __startupCacheReads?: number }).__startupCacheReads),
		).toBe(0)
		state.authCode = 0
		state.authGate = gate()
		await shell.getByRole('button', { name: '重试', exact: true }).click()
		await expect.poll(() => state.authReads).toBe(2)
		await expect(shell.locator('.clock time')).toBeVisible()
		await expectNoPrivateContent(page)
		expect(state.privateReads).toEqual([])
		state.authGate.release()
		await expect(page.getByRole('link', { name: 'Authorized app', exact: true })).toBeVisible()
		await expect(shell).toHaveCount(0)
	} finally {
		state.authGate?.release()
	}
})

test('a direct settings entry keeps its own loading state without the home shell', async ({ page }) => {
	const state = await fixture(page, true)
	state.authGate = gate()
	try {
		await page.goto('/#/settings/appearance')
		await expect(page.getByText('正在验证身份…', { exact: true })).toBeVisible()
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
		await expectNoPrivateContent(page)
		expect(state.privateReads).toEqual([])
		state.authGate.release()
		await expect(page.locator('.settings-window')).toBeVisible()
		await expect(page.getByLabel('面板名称', { exact: true })).toHaveValue('Authorized home')
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
	} finally {
		state.authGate.release()
	}
})

test('a direct login entry does not render a home shell or read personal data', async ({ page }) => {
	const state = await fixture(page, true)
	await page.goto('/#/login')
	await expect(page.locator('.login-page')).toBeVisible()
	await expect(page.locator('.home-startup-shell')).toHaveCount(0)
	await expectNoPrivateContent(page)
	expect(state.authReads).toBe(0)
	expect(state.privateReads).toEqual([])
})

test('switching to settings during authentication cannot restore cached home data into its form', async ({
	page,
}) => {
	const state = await fixture(page, true)
	state.authGate = gate()
	state.panelGate = gate()
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expectPublicShell(page)
		await page.evaluate(() => {
			location.hash = '/settings/appearance'
		})
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
		await expect(page.getByText('正在验证身份…', { exact: true })).toBeVisible()
		state.authGate.release()
		await expect(page.locator('.settings-window')).toBeVisible()
		await expect.poll(() => state.privateReads.includes('/api/panel/userConfig/get')).toBe(true)
		await expect(page.getByLabel('面板名称', { exact: true })).toHaveCount(0)
		await expectNoPrivateContent(page)
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
		state.panelGate.release()
		await expect(page.getByLabel('面板名称', { exact: true })).toHaveValue('Authorized home')
	} finally {
		state.authGate.release()
		state.panelGate.release()
	}
})

test('switching to login ignores late authentication and home-module completion', async ({ page }) => {
	const state = await fixture(page, true)
	state.authGate = gate()
	const code = gate()
	let codeRequested = false
	await page.route('**/assets/Home-*.js', async (route) => {
		codeRequested = true
		await code.waiting
		await route.continue()
	})
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expectPublicShell(page)
		await expect.poll(() => codeRequested).toBe(true)
		await page.evaluate(() => {
			location.hash = '/login'
		})
		await expect(page.locator('.login-page')).toBeVisible()
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
		state.authGate.release()
		code.release()
		await page.waitForLoadState('networkidle')
		await expect(page).toHaveURL(/#\/login$/)
		await expect(page.locator('.login-page')).toBeVisible()
		await expect(page.locator('.home-startup-shell, .home-page')).toHaveCount(0)
		await expectNoPrivateContent(page)
		expect(state.privateReads).toEqual([])
	} finally {
		state.authGate.release()
		code.release()
	}
})

for (const theme of ['light', 'dark'] as const) {
	for (const viewport of [
		{ width: 320, height: 640 },
		{ width: 641, height: 390 },
		{ width: 1440, height: 900 },
	]) {
		test(`public startup fits ${viewport.width}x${viewport.height} in ${theme}`, async ({ page }, info) => {
			await page.setViewportSize(viewport)
			const state = await fixture(page, false, theme)
			state.authGate = gate()
			try {
				await page.goto('/#/')
				const shell = await expectPublicShell(page)
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
				const geometry = await shell.evaluate((element) => {
					const clock = element.querySelector('.clock')!.getBoundingClientRect()
					const title = element.querySelector('.home-logo-text')!.getBoundingClientRect()
					const search = element.querySelector('.home-startup-search')!.getBoundingClientRect()
					return {
						overflow: document.documentElement.scrollWidth > innerWidth,
						clockVisible:
							clock.left >= 0 && clock.right <= innerWidth && clock.top >= 0 && clock.bottom <= innerHeight,
						identityOverlap:
							title.left < clock.right &&
							title.right > clock.left &&
							title.top < clock.bottom &&
							title.bottom > clock.top,
						searchOverlap:
							search.left < clock.right &&
							search.right > clock.left &&
							search.top < clock.bottom &&
							search.bottom > clock.top,
					}
				})
				expect(geometry).toEqual({
					overflow: false,
					clockVisible: true,
					identityOverlap: false,
					searchOverlap: false,
				})
				await page.screenshot({
					path: info.outputPath(`startup-${theme}-${viewport.width}.png`),
					animations: 'disabled',
				})
			} finally {
				state.authGate.release()
			}
		})
	}
}

test('high contrast startup keeps its clock and retry readable without motion or clipping', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 320, height: 480 })
	await page.emulateMedia({ forcedColors: 'active', contrast: 'more', reducedMotion: 'reduce' })
	const state = await fixture(page)
	state.authCode = 500
	await page.goto('/#/')
	const shell = page.locator('.home-startup-shell')
	await expect(shell.locator('.clock time')).toBeVisible()
	const retry = shell.getByRole('button', { name: '重试', exact: true })
	await expect(retry).toBeVisible()
	await retry.click({ trial: true })
	await expect(shell.locator('.home-startup-search')).toHaveCSS('border-top-style', 'solid')
	await expect(shell.locator('.home-logo-text')).toHaveCSS('-webkit-text-stroke-width', '0px')
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	expect(
		await shell.locator('.clock').evaluate((element) => !!element.closest('[role="status"], [aria-live]')),
	).toBe(false)
	await page.screenshot({ path: info.outputPath('startup-high-contrast-error.png'), animations: 'disabled' })
})
