import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function gate() {
	let release!: () => void
	const waiting = new Promise<void>((resolve) => {
		release = resolve
	})
	return { waiting, release }
}

interface Scenario {
	theme?: 'light' | 'dark'
	startupTone?: string
	storageUnavailable?: boolean
	storageWriteUnavailable?: boolean
	image?: 'dark' | 'bright' | 'missing' | 'none'
	panel?: Record<string, unknown>
	groups?: unknown[]
}

async function fixture(page: Page, scenario: Scenario = {}) {
	const state = {
		authCode: 0,
		authReads: 0,
		privateReads: [] as string[],
		imageReads: 0,
		authGate: undefined as ReturnType<typeof gate> | undefined,
		panelGate: undefined as ReturnType<typeof gate> | undefined,
		imageGate: undefined as ReturnType<typeof gate> | undefined,
	}
	await page.emulateMedia({ colorScheme: scenario.theme || 'light', reducedMotion: 'reduce' })
	await page.addInitScript(
		({ theme, startupTone, storageUnavailable, storageWriteUnavailable }) => {
			// Seed once so a reload tests the hint written by the running application.
			if (!sessionStorage.getItem('startup-background-fixture')) {
				sessionStorage.setItem('startup-background-fixture', '1')
				localStorage.setItem(
					'zpanel-preferences',
					JSON.stringify({
						version: 1,
						state: {
							token: 'startup-background-fixture',
							accounts: [],
							language: 'zh-CN',
							theme,
							network: 'wan',
							homeEditHintDismissed: true,
						},
					}),
				)
				if (startupTone !== undefined) localStorage.setItem('zpanel-startup-tone', startupTone)
			}
			const trackingWindow = window as Window & {
				__startupBackgroundCacheReads?: number
				__startupBackgroundHintWrites?: number
			}
			trackingWindow.__startupBackgroundCacheReads = 0
			trackingWindow.__startupBackgroundHintWrites = 0
			const read = Storage.prototype.getItem
			const write = Storage.prototype.setItem
			Storage.prototype.getItem = function (key: string) {
				if (key === 'zpanel-home-cache') trackingWindow.__startupBackgroundCacheReads!++
				if (storageUnavailable && key === 'zpanel-startup-tone') throw new Error('Storage unavailable')
				return read.call(this, key)
			}
			Storage.prototype.setItem = function (key: string, value: string) {
				if (key === 'zpanel-startup-tone') {
					trackingWindow.__startupBackgroundHintWrites!++
					if (storageWriteUnavailable) throw new DOMException('Quota exceeded', 'QuotaExceededError')
				}
				if (storageUnavailable && key === 'zpanel-startup-tone') throw new Error('Storage unavailable')
				return write.call(this, key, value)
			}
		},
		{
			theme: scenario.theme || 'light',
			startupTone: scenario.startupTone,
			storageUnavailable: scenario.storageUnavailable,
			storageWriteUnavailable: scenario.storageWriteUnavailable,
		},
	)
	await page.route('**/api/**', async (route) => {
		const path = new URL(route.request().url()).pathname
		let code = 0
		let data: unknown = null
		if (path === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		else if (path === '/api/user/getAuthInfo') {
			state.authReads++
			await state.authGate?.waiting
			code = state.authCode
			data = { user: { id: 7900, role: 2 }, visitMode: 0 }
		} else {
			state.privateReads.push(path)
			if (path === '/api/panel/userConfig/get') {
				await state.panelGate?.waiting
				data = {
					panel: {
						logoText: 'Startup background home',
						backgroundImageSrc: scenario.image === 'none' ? '' : '/startup-background.svg',
						backgroundBlur: 0,
						backgroundMaskNumber: 0,
						wallpaperAutoContrast: false,
						searchBoxShow: false,
						footerHtml: '',
						...scenario.panel,
					},
					panelWarnings: [],
				}
			} else if (path === '/api/panel/itemIconGroup/getNavigation') data = scenario.groups || []
		}
		await route.fulfill({ json: { code, data, msg: 'Startup background fixture' } })
	})
	await page.route('**/startup-background.svg', async (route) => {
		state.imageReads++
		await state.imageGate?.waiting
		if (scenario.image === 'missing') return route.fulfill({ status: 404, body: '' })
		const color = scenario.image === 'bright' ? '#f5f0e5' : '#14202d'
		await route.fulfill({
			contentType: 'image/svg+xml',
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><path fill="${color}" d="M0 0h1440v1000H0z"/></svg>`,
		})
	})
	return state
}

async function backgroundPixels(page: Page) {
	const screenshot = await page.screenshot({ animations: 'disabled' })
	return page.evaluate(async (encoded) => {
		const image = new Image()
		image.src = `data:image/png;base64,${encoded}`
		await image.decode()
		const canvas = document.createElement('canvas')
		canvas.width = image.width
		canvas.height = image.height
		const context = canvas.getContext('2d')!
		context.drawImage(image, 0, 0)
		// The lower-right dock casts a shadow past its bounds; sample clear background.
		return [12, Math.floor(image.width / 2)].map((x) =>
			Array.from(context.getImageData(x, image.height - 12, 1, 1).data).slice(0, 3),
		)
	}, screenshot.toString('base64'))
}

async function expectDimBackground(page: Page) {
	for (const pixel of await backgroundPixels(page)) expect(Math.max(...pixel)).toBeLessThan(80)
}

async function expectLightBackground(page: Page) {
	for (const pixel of await backgroundPixels(page)) expect(Math.min(...pixel)).toBeGreaterThan(200)
}

test('a dark wallpaper stays dim from the HTML paint through authentication, appearance, image loading and reload', async ({
	page,
}, info) => {
	const state = await fixture(page)
	state.authGate = gate()
	state.panelGate = gate()
	state.imageGate = gate()
	const entry = gate()
	let entryRequested = false
	await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
		entryRequested = true
		await entry.waiting
		await route.continue()
	})
	try {
		await page.goto('/#/', { waitUntil: 'commit' })
		await expect.poll(() => entryRequested).toBe(true)
		await expect(page.locator('html')).toHaveAttribute('data-startup-tone', 'dark')
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
		await expect(page.locator('#app')).toBeEmpty()
		await expectDimBackground(page)
		await page.screenshot({ path: info.outputPath('dark-before-entry-module.png'), animations: 'disabled' })
		entry.release()
		const shell = page.locator('.home-startup-shell')
		await expect(shell.getByRole('status')).toContainText('正在验证身份…')
		await expect(shell).toHaveAttribute('data-home-text-tone', 'dark')
		expect(state.privateReads).toEqual([])
		expect(
			await page.evaluate(
				() => (window as Window & { __startupBackgroundCacheReads?: number }).__startupBackgroundCacheReads,
			),
		).toBe(0)
		await expectDimBackground(page)
		await page.screenshot({ path: info.outputPath('dark-authentication-shell.png'), animations: 'disabled' })
		state.authGate.release()
		await expect.poll(() => state.privateReads.includes('/api/panel/userConfig/get')).toBe(true)
		await expect(shell).toBeVisible()
		await expectDimBackground(page)
		state.panelGate.release()
		const home = page.locator('.home-page')
		await expect.poll(() => state.imageReads).toBeGreaterThan(0)
		await expect(shell).toBeVisible()
		await expect(home).toHaveCount(0)
		await expectDimBackground(page)
		await page.screenshot({ path: info.outputPath('dark-wallpaper-loading.png'), animations: 'disabled' })
		state.imageGate.release()
		await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(home.locator('.home-background')).toHaveCSS('background-image', /startup-background\.svg/)
		await expect.poll(() => page.evaluate(() => localStorage.getItem('zpanel-startup-tone'))).toBe('dark')
		await expectDimBackground(page)
		await page.screenshot({ path: info.outputPath('dark-wallpaper-ready.png'), animations: 'disabled' })
		const previousPrivateReads = state.privateReads.length
		state.authGate = gate()
		await page.reload({ waitUntil: 'domcontentloaded' })
		await expect(shell.getByRole('status')).toContainText('正在验证身份…')
		await expect(page.locator('html')).toHaveAttribute('data-startup-tone', 'dark')
		expect(state.privateReads).toHaveLength(previousPrivateReads)
		await expectDimBackground(page)
	} finally {
		entry.release()
		state.authGate.release()
		state.panelGate.release()
		state.imageGate.release()
	}
})

test('a saved light background hint controls the public shell even with a dark interface theme', async ({
	page,
}, info) => {
	const state = await fixture(page, { startupTone: 'light', theme: 'dark', image: 'bright' })
	state.authGate = gate()
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
		await expect(page.locator('html')).toHaveAttribute('data-startup-tone', 'light')
		await expect(page.locator('.home-startup-shell')).toHaveAttribute('data-home-text-tone', 'light')
		await expectLightBackground(page)
		expect(state.privateReads).toEqual([])
		await page.screenshot({
			path: info.outputPath('light-startup-dark-interface.png'),
			animations: 'disabled',
		})
	} finally {
		state.authGate.release()
	}
})

for (const entry of ['settings', 'login'] as const) {
	test(`returning from a direct ${entry} entry preserves the saved dark home hint through code and image waits`, async ({
		page,
	}, info) => {
		const state = await fixture(page, { startupTone: 'dark', theme: 'light' })
		state.imageGate = gate()
		const homeCode = gate()
		let homeRequested = false
		let loginSubmissions = 0
		await page.route('**/assets/Home-*.js', async (route) => {
			homeRequested = true
			await homeCode.waiting
			await route.continue()
		})
		if (entry === 'login') {
			await page.route('**/api/login', async (route) => {
				loginSubmissions++
				expect(route.request().postDataJSON()).toMatchObject({
					username: 'startup@example.test',
					password: '12345678',
				})
				await route.fulfill({
					json: { code: 0, data: { id: 7900, role: 2, token: 'startup-login-fixture' } },
				})
			})
		}
		try {
			await page.goto(entry === 'settings' ? '/#/settings/appearance' : '/#/login', {
				waitUntil: 'domcontentloaded',
			})
			await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
			await expect(page.locator('html')).toHaveAttribute('data-startup-tone', 'dark')
			await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(238, 245, 255)')
			if (entry === 'settings') {
				await expect(page.getByLabel('面板名称', { exact: true })).toHaveValue('Startup background home')
				await page.locator('.settings-header').getByRole('button', { name: '返回首页', exact: true }).click()
			} else {
				await expect(page.locator('.login-page')).toBeVisible()
				await page.getByLabel('账号', { exact: true }).fill('startup@example.test')
				await page.getByLabel('密码', { exact: true }).fill('12345678')
				await page.getByRole('button', { name: '登录', exact: true }).click()
				await expect.poll(() => loginSubmissions).toBe(1)
			}
			await expect.poll(() => homeRequested).toBe(true)
			const shell = page.locator('.home-startup-shell')
			await expect(shell).toHaveAttribute('data-home-text-tone', 'dark')
			await expect(shell.locator('.home-logo-text')).toHaveText('ZPanel')
			await expectDimBackground(page)
			await page.screenshot({
				path: info.outputPath(`${entry}-to-home-code-wait.png`),
				animations: 'disabled',
			})
			homeCode.release()
			// Navigation is read by Home, so this distinguishes the decoded-image wait
			// from the earlier public route-code wait that uses the same status label.
			await expect
				.poll(() => state.privateReads.includes('/api/panel/itemIconGroup/getNavigation'))
				.toBe(true)
			await expect.poll(() => state.imageReads).toBeGreaterThan(0)
			await expect(shell).toBeVisible()
			await expect(page.locator('.home-page')).toHaveCount(0)
			await expectDimBackground(page)
			state.imageGate.release()
			const home = page.locator('.home-page')
			await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(home.locator('.home-background')).toHaveCSS('background-image', /startup-background\.svg/)
			await expectDimBackground(page)
		} finally {
			homeCode.release()
			state.imageGate.release()
		}
	})
}

test('an unknown startup keeps its readable public shell until a light wallpaper with black text is decoded', async ({
	page,
}, info) => {
	const state = await fixture(page, { image: 'bright', panel: { iconTextColor: '#000000' } })
	state.imageGate = gate()
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expect.poll(() => state.imageReads).toBeGreaterThan(0)
		const shell = page.locator('.home-startup-shell')
		await expect(shell).toHaveAttribute('data-home-text-tone', 'dark')
		await expect(shell.locator('.home-logo-text')).toHaveText('ZPanel')
		await expect(shell.locator('.home-logo-text')).toHaveCSS('color', 'rgb(255, 255, 255)')
		await expect(shell.locator('.clock time')).toHaveCSS('color', 'rgb(255, 255, 255)')
		await expect(page.locator('.home-page')).toHaveCount(0)
		await expectDimBackground(page)
		await page.screenshot({
			path: info.outputPath('unknown-light-wallpaper-readable-wait.png'),
			animations: 'disabled',
		})
		state.imageGate.release()
		const home = page.locator('.home-page')
		await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(home.locator('.home-logo-text')).toHaveText('Startup background home')
		await expect(home.locator('.home-logo-text')).toHaveCSS('color', 'rgb(0, 0, 0)')
		await expect(home.locator('.home-background')).toHaveCSS('background-image', /startup-background\.svg/)
		await expectLightBackground(page)
		await expect(shell).toHaveCount(0)
	} finally {
		state.imageGate.release()
	}
})

for (const phase of ['request', 'decode'] as const) {
	test(`a stalled wallpaper ${phase} stops blocking home after its display budget and ignores the late result`, async ({
		page,
	}) => {
		await page.clock.install()
		const state = await fixture(page, { startupTone: 'dark' })
		if (phase === 'request') state.imageGate = gate()
		else {
			await page.addInitScript(() => {
				let release!: () => void
				const pending = new Promise<void>((resolve) => {
					release = resolve
				})
				const probe = { started: 0, release }
				Object.assign(window, { startupFixtureDecode: probe })
				const decode = HTMLImageElement.prototype.decode
				HTMLImageElement.prototype.decode = function () {
					if (new URL(this.src, location.href).pathname === '/startup-background.svg') {
						probe.started++
						return pending
					}
					return decode.call(this)
				}
			})
		}
		try {
			await page.goto('/#/', { waitUntil: 'domcontentloaded' })
			await expect.poll(() => state.imageReads).toBeGreaterThan(0)
			if (phase === 'decode') {
				await expect
					.poll(() =>
						page.evaluate(
							() =>
								(window as typeof window & { startupFixtureDecode: { started: number } }).startupFixtureDecode
									.started,
						),
					)
					.toBeGreaterThan(0)
			}
			await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100))
			await expect(page.locator('.home-startup-shell')).toBeVisible()
			await expectDimBackground(page)
			await page.clock.runFor(15_000)
			const home = page.locator('.home-page')
			await expect(home).toHaveAttribute('data-wallpaper-status', 'error')
			await expect(page.locator('.home-startup-shell')).toHaveCount(0)
			await page.clock.resume()
			await expect(home.getByRole('button', { name: '设置', exact: true })).toBeVisible()
			await home.getByRole('button', { name: '设置', exact: true }).click({ trial: true })
			await expectLightBackground(page)
			await expect
				.poll(() =>
					page.evaluate(
						() =>
							JSON.parse(localStorage.getItem('zpanel-home-cache') || '{}').queries?.panel?.data?.panel
								?.backgroundImageSrc,
					),
				)
				.toBe('/startup-background.svg')
			if (phase === 'request') state.imageGate!.release()
			else {
				await page.evaluate(() => {
					;(
						window as typeof window & { startupFixtureDecode: { release: () => void } }
					).startupFixtureDecode.release()
				})
			}
			await page.waitForLoadState('networkidle')
			await expect(home).toHaveAttribute('data-wallpaper-status', 'error')
			await expect(home.locator('.home-background')).toHaveCSS('background-image', 'none')
			await expect(page.locator('.home-startup-shell')).toHaveCount(0)
			await expectLightBackground(page)
		} finally {
			state.imageGate?.release()
			if (phase === 'decode') {
				await page.evaluate(() => {
					;(
						window as typeof window & { startupFixtureDecode?: { release: () => void } }
					).startupFixtureDecode?.release()
				})
			}
		}
	})
}

for (const scenario of [
	{ name: 'an invalid stored hint', startupTone: 'url(https://private.example.test/wallpaper)' },
	{ name: 'unavailable hint storage', storageUnavailable: true },
]) {
	test(`${scenario.name} falls back to dim startup and still loads the wallpaper`, async ({ page }) => {
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		const state = await fixture(page, scenario)
		state.authGate = gate()
		try {
			await page.goto('/#/', { waitUntil: 'domcontentloaded' })
			await expect(page.locator('html')).toHaveAttribute('data-startup-tone', 'dark')
			await expectDimBackground(page)
			state.authGate.release()
			await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
			await expectDimBackground(page)
			expect(errors).toEqual([])
		} finally {
			state.authGate.release()
		}
	})
}

test('a readable startup hint with a quota-blocked writer updates the page without losing the saved value', async ({
	page,
}) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await fixture(page, { startupTone: 'light', storageWriteUnavailable: true })
	await page.goto('/#/')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(page.locator('html')).toHaveAttribute('data-startup-tone', 'dark')
	await expect
		.poll(() =>
			page.evaluate(
				() => (window as Window & { __startupBackgroundHintWrites?: number }).__startupBackgroundHintWrites,
			),
		)
		.toBeGreaterThan(0)
	expect(await page.evaluate(() => localStorage.getItem('zpanel-startup-tone'))).toBe('light')
	await expectDimBackground(page)
	expect(errors).toEqual([])
})

for (const image of ['none', 'missing'] as const) {
	for (const theme of ['light', 'dark'] as const) {
		test(`${image} wallpaper restores the ${theme} theme gradient and corrects the next startup hint`, async ({
			page,
		}) => {
			const state = await fixture(page, { image, theme, startupTone: theme === 'dark' ? 'light' : 'dark' })
			await page.goto('/#/')
			await expect(page.locator('.home-page')).toHaveAttribute(
				'data-wallpaper-status',
				image === 'none' ? 'none' : 'error',
			)
			await expect.poll(() => page.evaluate(() => localStorage.getItem('zpanel-startup-tone'))).toBe(theme)
			if (theme === 'dark') await expectDimBackground(page)
			else await expectLightBackground(page)
			await expect(page.locator('.home-startup-shell')).toHaveCount(0)
			state.authGate = gate()
			try {
				await page.reload({ waitUntil: 'domcontentloaded' })
				await expect(page.locator('.home-startup-shell')).toBeVisible()
				await expect(page.locator('html')).toHaveAttribute('data-startup-tone', theme)
				if (theme === 'dark') await expectDimBackground(page)
				else await expectLightBackground(page)
			} finally {
				state.authGate.release()
			}
		})
	}
}

test('the next startup hint follows the shaded wallpaper brightness rather than the theme or manual text color', async ({
	page,
}) => {
	await fixture(page, {
		image: 'bright',
		startupTone: 'light',
		theme: 'light',
		panel: { backgroundMaskNumber: 0.9, iconTextColor: '#000000' },
	})
	await page.goto('/#/')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(page.locator('.home-page')).toHaveAttribute('data-home-text-tone', 'light')
	await expect.poll(() => page.evaluate(() => localStorage.getItem('zpanel-startup-tone'))).toBe('dark')
	await expectDimBackground(page)
})

test('ordinary wallpaper reanalysis keeps the decoded image visible while viewport and theme results are pending', async ({
	page,
}) => {
	await fixture(page)
	await page.goto('/#/')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	interface Reading {
		status: string | null
		image: string
		width: number
		theme: string | undefined
	}
	await page.evaluate(() => {
		const probe = { readings: [] as Reading[] }
		Object.assign(window, { startupBackgroundReanalysis: probe })
		const readPixels = CanvasRenderingContext2D.prototype.getImageData
		CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh, settings) {
			const home = document.querySelector('.home-page')
			const background = home?.querySelector('.home-background')
			if (background) {
				// Observe committed loading DOM immediately before its next sample can commit.
				probe.readings.push({
					status: home!.getAttribute('data-wallpaper-status'),
					image: getComputedStyle(background).backgroundImage,
					width: innerWidth,
					theme: document.documentElement.dataset.theme,
				})
			}
			return readPixels.call(this, sx, sy, sw, sh, settings)
		}
	})
	const readings = () =>
		page.evaluate(
			() =>
				(window as typeof window & { startupBackgroundReanalysis: { readings: Reading[] } })
					.startupBackgroundReanalysis.readings,
		)
	for (const [theme, width] of [
		['light', 320],
		['dark', 320],
		['dark', 1440],
	] as const) {
		const before = (await readings()).length
		await page.evaluate((theme) => {
			document.documentElement.dataset.theme = theme
		}, theme)
		await page.setViewportSize({ width, height: 1000 })
		await expect
			.poll(async () =>
				(await readings())
					.slice(before)
					.some((value) => value.status === 'loading' && value.width === width && value.theme === theme),
			)
			.toBe(true)
		for (const reading of (await readings()).slice(before))
			expect(reading.image).toContain('startup-background.svg')
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expectDimBackground(page)
	}
})

test('a decoded remote wallpaper is visible while its separate CORS analysis request is still waiting', async ({
	page,
}, info) => {
	const remoteImage = 'http://startup-wallpaper.example.test/blocked-analysis.svg'
	await page.clock.install()
	await fixture(page, { startupTone: 'light', panel: { backgroundImageSrc: remoteImage } })
	const cors = gate()
	let corsRequested = false
	await page.route(remoteImage, async (route) => {
		if (route.request().headers().origin) {
			corsRequested = true
			await cors.waiting
		}
		await route.fulfill({
			contentType: 'image/svg+xml',
			headers: { 'access-control-allow-origin': 'https://different.test' },
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><path fill="#283b52" d="M0 0h1440v1000H0z"/></svg>',
		})
	})
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expect.poll(() => corsRequested).toBe(true)
		await expect(page.locator('.home-background')).toHaveCSS('background-image', `url("${remoteImage}")`)
		await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100))
		const home = page.locator('.home-page')
		await expect(home).toHaveAttribute('data-wallpaper-status', 'loading')
		const displayed = await backgroundPixels(page)
		for (const pixel of displayed) {
			for (const [channel, expected] of [40, 59, 82].entries())
				expect(Math.abs(pixel[channel] - expected)).toBeLessThanOrEqual(2)
		}
		await page.screenshot({
			path: info.outputPath('decoded-wallpaper-pending-cors.png'),
			animations: 'disabled',
		})
		await page.clock.runFor(1500)
		await expect(home).toHaveAttribute('data-wallpaper-status', 'unreadable')
		expect(await backgroundPixels(page)).toEqual(displayed)
		await expect.poll(() => page.evaluate(() => localStorage.getItem('zpanel-startup-tone'))).toBe('dark')
		cors.release()
		await page.clock.resume()
		await expect(home).toHaveAttribute('data-wallpaper-status', 'unreadable')
		expect(await backgroundPixels(page)).toEqual(displayed)
	} finally {
		cors.release()
	}
})

test('automatic contrast keeps a bright decoded wallpaper covered until its pending analysis supplies the dark veil', async ({
	page,
}, info) => {
	const remoteImage = 'http://startup-wallpaper.example.test/bright-pending-analysis.svg'
	await page.clock.install()
	await fixture(page, {
		startupTone: 'dark',
		panel: { backgroundImageSrc: remoteImage, wallpaperAutoContrast: true, iconTextColor: '#ffffff' },
	})
	const cors = gate()
	let corsRequested = false
	await page.route(remoteImage, async (route) => {
		if (route.request().headers().origin) {
			corsRequested = true
			await cors.waiting
		}
		await route.fulfill({
			contentType: 'image/svg+xml',
			headers: { 'Access-Control-Allow-Origin': '*' },
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><path fill="#f5f0e5" d="M0 0h1440v1000H0z"/></svg>',
		})
	})
	try {
		await page.goto('/#/', { waitUntil: 'domcontentloaded' })
		await expect.poll(() => corsRequested).toBe(true)
		// Pause only after the display decode and CORS request establish the analysis timer.
		// A short lead avoids asking Playwright to pause at an already elapsed timestamp.
		await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 100))
		const home = page.locator('.home-page')
		await expect(page.locator('.home-startup-shell')).toBeVisible()
		await expect(home).toHaveCount(0)
		await expectDimBackground(page)
		await page.screenshot({
			path: info.outputPath('bright-wallpaper-protected-analysis.png'),
			animations: 'disabled',
		})
		await page.clock.runFor(1500)
		await expect(home).toHaveAttribute('data-wallpaper-status', 'unreadable')
		await expect(page.locator('.home-background')).toHaveCSS('background-image', `url("${remoteImage}")`)
		for (const pixel of await backgroundPixels(page)) expect(Math.max(...pixel)).toBeLessThan(150)
		cors.release()
		await page.clock.resume()
		await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(home).not.toHaveCSS('--wallpaper-scrim', '0')
		await expect(home.locator('.home-background')).toHaveCSS('background-image', `url("${remoteImage}")`)
		const scrim = await home.evaluate((element) =>
			Number(getComputedStyle(element).getPropertyValue('--wallpaper-scrim')),
		)
		expect(scrim).toBeGreaterThan(0)
		expect(scrim).toBeLessThan(1)
		const expected = [245, 240, 229].map(
			(value, channel) => value * (1 - scrim) + [10, 15, 23][channel] * scrim,
		)
		for (const pixel of await backgroundPixels(page)) {
			for (const [channel, value] of expected.entries())
				expect(Math.abs(pixel[channel] - value)).toBeLessThanOrEqual(2)
		}
		await expect.poll(() => page.evaluate(() => localStorage.getItem('zpanel-startup-tone'))).toBe('dark')
	} finally {
		cors.release()
	}
})

test('wallpaper revalidation preserves an open editor draft while the new image is pending and after it loads', async ({
	page,
}) => {
	await page.clock.install()
	const panel: Record<string, unknown> = { backgroundImageSrc: '/startup-background.svg' }
	const state = await fixture(page, {
		startupTone: 'dark',
		panel,
		groups: [
			{
				id: 7900,
				title: 'Editable startup group',
				items: [
					{
						id: 7901,
						title: 'Editable startup app',
						url: 'https://example.test/startup',
						openMethod: 2,
						itemIconGroupId: 7900,
						icon: { itemType: 1, text: 'E' },
					},
				],
			},
		],
	})
	const image = gate()
	let updatedImageRequested = false
	await page.route('**/startup-background-updated.svg', async (route) => {
		updatedImageRequested = true
		await image.waiting
		await route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><path fill="#253448" d="M0 0h1440v1000H0z"/></svg>',
		})
	})
	try {
		await page.goto('/#/')
		const home = page.locator('.home-page')
		await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
		await page.getByRole('link', { name: 'Editable startup app', exact: true }).click({ button: 'right' })
		await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
		const dialog = page.getByRole('dialog')
		const title = dialog.getByLabel('标题', { exact: true })
		const draft = 'Unsaved wallpaper revalidation draft'
		await title.fill(draft)
		const panelReads = state.privateReads.filter((path) => path === '/api/panel/userConfig/get').length
		panel.backgroundImageSrc = '/startup-background-updated.svg'
		// Reconnect is a public browser signal that revalidates stale queries without
		// saving the open editor or reaching into React/TanStack internals.
		await page.clock.fastForward(31_000)
		await page.evaluate(() => window.dispatchEvent(new Event('offline')))
		await page.evaluate(() => window.dispatchEvent(new Event('online')))
		await expect
			.poll(() => state.privateReads.filter((path) => path === '/api/panel/userConfig/get').length)
			.toBeGreaterThan(panelReads)
		await expect.poll(() => updatedImageRequested).toBe(true)
		await expect(home).toHaveAttribute('data-wallpaper-status', 'loading')
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
		await expect(dialog).toBeVisible()
		await expect(title).toHaveValue(draft)
		image.release()
		await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(home.locator('.home-background')).toHaveCSS(
			'background-image',
			/startup-background-updated\.svg/,
		)
		await expect(page.locator('.home-startup-shell')).toHaveCount(0)
		await expect(dialog).toBeVisible()
		await expect(title).toHaveValue(draft)
		expect(state.privateReads).not.toContain('/api/panel/itemIcon/edit')
	} finally {
		image.release()
	}
})
