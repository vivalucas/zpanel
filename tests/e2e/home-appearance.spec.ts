import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

let account: { token: string }
const svg = (body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">${body}</svg>`
const wallpapers = {
	light: svg('<path fill="#f5f0e5" d="M0 0h1600v1000H0z"/>'),
	dark: svg('<path fill="#14202d" d="M0 0h1600v1000H0z"/>'),
	mixed: svg('<path fill="#fff" d="M0 0h800v1000H0z"/><path fill="#000" d="M800 0h800v1000H800z"/>'),
}
async function home(page: Page, image: string, panel: Record<string, unknown> = {}, backgrounds?: string[]) {
	await page.addInitScript((user) => {
		if (localStorage.getItem('zpanel-preferences')) return
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: user.token,
					accounts: [{ token: user.token, user }],
					theme: 'auto',
					language: 'zh-CN',
					network: 'wan',
				},
			}),
		)
	}, account)
	await page.route('**/wallpaper-*.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: image,
			// Same-origin fixtures load normally; remote fixtures deny canvas access.
			headers: { 'access-control-allow-origin': 'https://different.test' },
		}),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					panel: {
						backgroundImageSrc: '/wallpaper-fixture.svg',
						backgroundMaskNumber: 0,
						iconStyle: 2,
						marginTop: 4,
						marginBottom: 4,
						...panel,
					},
					panelWarnings: [],
				},
			},
		}),
	)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: [
					{ id: 801, title: '常用网站', items: [] },
					{
						id: 802,
						title: '工作',
						items: (backgrounds || [undefined]).map((backgroundColor, index) => ({
							id: 901 + index,
							title: index ? `Color ${index}` : 'Workspace',
							description: '项目资料与工作空间',
							url: 'https://example.com',
							openMethod: 2,
							icon: { itemType: 1, text: 'W', backgroundColor },
						})),
					},
				],
			},
		}),
	)
	await page.goto(`/?wallpaperFixture=${Date.now()}#/`)
	await expect(page.locator('.navigation-group')).toHaveCount(2)
}

test.beforeAll(async ({ request }) => {
	const json = await (
		await request.post('/api/login', { data: { username: 'admin@zpanel.local', password: '12345678' } })
	).json()
	expect(json.code).toBe(0)
	account = json.data
})

for (const ink of ['white', 'black'] as const) {
	for (const tone of ['light', 'dark', 'mixed'] as const) {
		test(`automatic contrast keeps fixed ${ink} text readable on ${tone} wallpaper in both UI themes and narrow widths`, async ({
			page,
		}, info) => {
			const errors: string[] = []
			page.on('pageerror', (error) => errors.push(error.message))
			await home(page, wallpapers[tone], {
				wallpaperAutoContrast: true,
				iconTextColor: ink === 'white' ? '#ffffff' : '#202733',
			})
			await expect(page.locator('.home-page')).toHaveAttribute(
				'data-wallpaper-tone',
				ink === 'white' ? 'dark' : 'light',
			)
			await expect(page.locator('.home-page')).toHaveAttribute(
				'data-wallpaper-mixed',
				String(tone === 'mixed'),
			)
			for (const theme of ['light', 'dark'] as const) {
				await page.emulateMedia({ colorScheme: theme })
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
				for (const width of [320, 390, 1440]) {
					await page.setViewportSize({ width, height: 1000 })
					await expect
						.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
						.toBe(true)
					await expect(page.locator('.home-identity')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
					for (const group of await page.locator('.navigation-group').all())
						await expect(group).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
					const heading = await page
						.locator('.group-heading h2')
						.first()
						.evaluate((element) => getComputedStyle(element).color)
					// Ant buttons animate their foreground after wallpaper analysis and theme changes.
					// Wait for the intended ink before measuring contrast, rather than sampling a transition.
					for (const action of await page.locator('.empty-group .ant-btn').all())
						await expect(action).toHaveCSS('color', heading)
					await expect(page.getByRole('textbox', { name: '搜索', exact: true })).toHaveCSS('color', heading)
					const contrast = await page.locator('.home-page').evaluate(
						(root, { kind, ink }) => {
							const context = document.createElement('canvas').getContext('2d')!
							const rgba = (value: string) => {
								context.clearRect(0, 0, 1, 1)
								context.fillStyle = value
								context.fillRect(0, 0, 1, 1)
								return [...context.getImageData(0, 0, 1, 1).data]
							}
							const mix = (front: number[], back: number[]) =>
								front.slice(0, 3).map((value, i) => (value * front[3]) / 255 + back[i] * (1 - front[3] / 255))
							const luminance = (rgb: number[]) =>
								rgb
									.map((n) => n / 255)
									.map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
									.reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0)
							// Include the page-wide veil, using the least favorable fixture pixel.
							const pixel =
								kind === 'dark'
									? [20, 32, 45]
									: kind === 'light'
										? [245, 240, 229]
										: ink === 'white'
											? [255, 255, 255]
											: [0, 0, 0]
							const base = mix(
								rgba(getComputedStyle(root.querySelector('.home-contrast-mask')!).backgroundColor),
								pixel,
							)
							return [
								...root.querySelectorAll(
									'.group-heading h2, .empty-group-message, .empty-group .ant-btn, .app-copy strong, .app-copy > span',
								),
							].map((element) => {
								const ancestors = []
								for (let node: Element | null = element; node && node !== root; node = node.parentElement)
									ancestors.unshift(node)
								let background = base
								for (const node of ancestors)
									background = mix(rgba(getComputedStyle(node).backgroundColor), background)
								const foreground = mix(rgba(getComputedStyle(element).color), background)
								const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b)
								return { text: element.textContent, ratio: (values[1] + 0.05) / (values[0] + 0.05) }
							})
						},
						{ kind: tone, ink },
					)
					for (const value of contrast)
						expect(value.ratio, `${theme} ${width} ${value.text}`).toBeGreaterThanOrEqual(4.5)
					await page.screenshot({
						path: info.outputPath(`${ink}-${tone}-${theme}-${width}.png`),
						animations: 'disabled',
					})
				}
			}
			await expect(page.getByRole('button', { name: '导入配置', exact: true })).toHaveCount(0)
			await page.getByRole('button', { name: '设置', exact: true }).click()
			await page.getByRole('menuitem', { name: '导入与导出', exact: true }).click()
			await expect(page).toHaveURL(/settings\/backup/)
			expect(errors).toEqual([])
		})
	}
}

test('viewport and theme reanalysis retain the existing wallpaper veil until the new result commits', async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: 'light' })
	await home(page, wallpapers.mixed, { wallpaperAutoContrast: true, iconTextColor: '#ffffff' })
	const root = page.locator('.home-page')
	await expect(root).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(root).not.toHaveCSS('--wallpaper-scrim', '0')
	interface Reading {
		status: string | null
		scrim: number
		theme: string | null
		width: number
	}
	await page.evaluate(() => {
		const probe = { readings: [] as Reading[] }
		Object.assign(window, { wallpaperReanalysisProbe: probe })
		const readPixels = CanvasRenderingContext2D.prototype.getImageData
		CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh, settings) {
			if (this.canvas.width > 1 && this.canvas.height > 1) {
				const root = document.querySelector('.home-page')!
				// This runs after the loading DOM commits, before its analysis can commit a result.
				probe.readings.push({
					status: root.getAttribute('data-wallpaper-status'),
					scrim: Number(getComputedStyle(root).getPropertyValue('--wallpaper-scrim')),
					theme: document.documentElement.getAttribute('data-theme'),
					width: this.canvas.width,
				})
			}
			return readPixels.call(this, sx, sy, sw, sh, settings)
		}
	})
	const readings = () =>
		page.evaluate(
			() =>
				(window as typeof window & { wallpaperReanalysisProbe: { readings: Reading[] } })
					.wallpaperReanalysisProbe.readings,
		)
	for (const [theme, width] of [
		['light', 320],
		['dark', 320],
		['dark', 1440],
		['light', 1440],
	] as const) {
		const before = (await readings()).length
		await page.emulateMedia({ colorScheme: theme })
		await page.setViewportSize({ width, height: 1000 })
		// Waiting for this viewport's readback avoids accepting the previous ready state
		// during the viewport probe's debounce.
		await expect
			.poll(async () =>
				(await readings())
					.slice(before)
					.some((value) => value.width === width && value.theme === theme && value.status === 'loading'),
			)
			.toBe(true)
		for (const value of (await readings())
			.slice(before)
			.filter((value) => value.width === width && value.theme === theme)) {
			expect(value.scrim, `${theme} ${width} while sampling`).toBeGreaterThan(0)
		}
		await expect(root).toHaveAttribute('data-wallpaper-status', 'ready')
		const ratio = await page.locator('.home-contrast-mask').evaluate((mask) => {
			const components = getComputedStyle(mask)
				.backgroundColor.match(/[\d.]+/g)!
				.map(Number)
			const alpha = components.length === 4 ? components[3] : 1
			const surface = [10, 15, 23].map((channel) => 255 * (1 - alpha) + channel * alpha)
			const luminance = surface.reduce((sum, channel, index) => {
				const value = channel / 255
				return (
					sum +
					[0.2126, 0.7152, 0.0722][index] *
						(value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
				)
			}, 0)
			return 1.05 / (luminance + 0.05)
		})
		expect(ratio).toBeGreaterThanOrEqual(4.5)
	}
})

test('fixed white text keeps its color while the contrast veil follows the actual cover crop', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 800 })
	await home(
		page,
		svg('<path fill="#fff" d="M0 0h1600v1000H0z"/><path fill="#000" d="M600 0h400v1000H600z"/>'),
		{ wallpaperAutoContrast: true },
	)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-tone', 'dark')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-mixed', 'true')
	await expect
		.poll(() =>
			page
				.locator('.home-page')
				.evaluate((element) => Number(getComputedStyle(element).getPropertyValue('--wallpaper-scrim'))),
		)
		.toBeGreaterThan(0)
	await page.setViewportSize({ width: 320, height: 1000 })
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-tone', 'dark')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-mixed', 'false')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
	await expect(page.locator('.group-heading h2').first()).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('uninspectable remote images preserve their brightness and explicit text overrides', async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: 'dark' })
	await home(page, wallpapers.light, {
		backgroundImageSrc: 'https://wallpaper.test/wallpaper-remote.svg',
		iconTextColor: '#b04171',
		clockColor: '#316e91',
	})
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-tone', 'light')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-mixed', 'true')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'unreadable')
	await expect(page.locator('.home-contrast-mask')).toHaveCSS('background-color', 'rgba(250, 251, 253, 0)')
	await expect(page.locator('.app-link')).toHaveCSS('color', 'rgb(176, 65, 113)')
	await expect(page.locator('.app-copy strong')).toHaveCSS('color', 'rgb(176, 65, 113)')
	await expect(page.locator('.app-copy > span')).toHaveCSS('color', 'rgb(176, 65, 113)')
	await expect(page.locator('.clock time')).toHaveCSS('color', 'rgb(49, 110, 145)')
	await page.getByRole('textbox', { name: '搜索', exact: true }).fill('no-such-app')
	await expect(page.getByText('没有找到匹配的应用')).toBeVisible()
	await page.locator('.ant-input-clear-icon').click()
	await expect(page.locator('.navigation-group')).toHaveCount(2)
})

test('fine mixed textures retain a readable veil at desktop and mobile sizes', async ({ page }, info) => {
	const texture = svg(
		'<defs><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path fill="#fff" d="M0 0h4v8H0z"/></pattern></defs><path fill="#000" d="M0 0h1600v1000H0z"/><path fill="url(#p)" d="M0 0h1600v1000H0z"/>',
	)
	await home(page, texture, { backgroundBlur: 0, wallpaperAutoContrast: true, iconTextColor: '#202733' })
	for (const width of [1440, 320]) {
		await page.setViewportSize({ width, height: 1000 })
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-tone', 'light')
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-mixed', 'true')
		const contrast = await page.locator('.home-page').evaluate((root) => {
			const ink = getComputedStyle(root.querySelector('.group-heading h2')!)
				.color.match(/[\d.]+/g)!
				.map(Number)
			const veil = getComputedStyle(root.querySelector('.home-contrast-mask')!)
				.backgroundColor.match(/[\d.]+/g)!
				.map(Number)
			const luminance = (rgb: number[]) =>
				rgb.slice(0, 3).reduce((sum, n, i) => {
					const value = n / 255
					return (
						sum +
						[0.2126, 0.7152, 0.0722][i] *
							(value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
					)
				}, 0)
			// Black stripes remain visible under the transparent headings.
			const background = luminance(veil.slice(0, 3).map((n) => n * veil[3]))
			return { ratio: (background + 0.05) / (luminance(ink) + 0.05), scrim: veil[3] }
		})
		expect(contrast.ratio).toBeGreaterThanOrEqual(4.5)
		expect(contrast.scrim).toBeGreaterThan(0.5)
		await page.screenshot({ path: info.outputPath(`fine-texture-${width}.png`), animations: 'disabled' })
	}
})

for (const tone of ['light', 'dark', 'none'] as const) {
	test(`text icons contrast with their own colors on ${tone} wallpaper`, async ({ page }) => {
		const backgrounds = [
			'#eef0ff',
			'#ffffff',
			'#123045',
			'#777777',
			'gold',
			'hsl(210 80% 20%)',
			'rgba(255,255,255,0.75)',
		]
		await page.emulateMedia({ colorScheme: tone === 'light' ? 'light' : 'dark' })
		await home(
			page,
			wallpapers[tone === 'light' ? 'light' : 'dark'],
			tone === 'none' ? { backgroundImageSrc: '' } : {},
			backgrounds,
		)
		await expect(page.locator('.home-page')).toHaveAttribute('data-home-text-tone', 'dark')
		const ratios = await page.locator('.item-icon').evaluateAll((icons, kind) => {
			const canvas = document.createElement('canvas')
			canvas.width = canvas.height = 1
			const context = canvas.getContext('2d')!
			const luminance = (rgb: ArrayLike<number>) =>
				[0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
					const n = rgb[i] / 255
					return sum + weight * (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
				}, 0)
			return icons.map((icon) => {
				context.fillStyle = kind === 'light' ? '#f5f0e5' : '#14202d'
				context.fillRect(0, 0, 1, 1)
				context.fillStyle = getComputedStyle(icon).backgroundColor
				context.fillRect(0, 0, 1, 1)
				const background = luminance(context.getImageData(0, 0, 1, 1).data)
				context.fillStyle = getComputedStyle(icon).color
				context.fillRect(0, 0, 1, 1)
				const ink = luminance(context.getImageData(0, 0, 1, 1).data)
				return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05)
			})
		}, tone)
		for (const [index, ratio] of ratios.entries())
			expect(ratio, `${tone} ${backgrounds[index]}`).toBeGreaterThanOrEqual(4.5)
	})
}

test('the first-use edit hint exposes actions, dismisses persistently, and preserves keyboard access', async ({
	page,
}) => {
	await home(page, wallpapers.dark)
	await expect(page.locator('.home-edit-hint')).toBeVisible()
	await expect(page.locator('.group-actions').first()).toHaveCSS('opacity', '0.7')
	await page.getByRole('button', { name: '知道了', exact: true }).click()
	await expect(page.locator('.home-edit-hint')).toHaveCount(0)
	await page.reload()
	await expect(page.locator('.navigation-group')).toHaveCount(2)
	await expect(page.locator('.home-edit-hint')).toHaveCount(0)
	const add = page.getByRole('button', { name: '常用网站 添加项目', exact: true })
	await add.focus()
	await expect(page.locator('.group-actions').first()).toHaveCSS('opacity', '1')
	await page.keyboard.press('Enter')
	await expect(page.getByRole('dialog')).toBeVisible()
})

test('touch users can add apps and navigate settings after dismissing the hint', async ({ browser }) => {
	const context = await browser.newContext({
		baseURL: 'http://127.0.0.1:16521',
		viewport: { width: 320, height: 844 },
		isMobile: true,
		hasTouch: true,
	})
	try {
		const page = await context.newPage()
		await home(page, wallpapers.light)
		await page.getByRole('button', { name: '知道了', exact: true }).tap()
		await page.getByRole('button', { name: '常用网站 添加项目', exact: true }).tap()
		await expect(page.getByRole('dialog')).toBeVisible()
		await page.getByRole('button', { name: '取消', exact: true }).tap()
		await page.getByRole('button', { name: '设置', exact: true }).tap()
		await page.getByRole('combobox', { name: '设置', exact: true }).tap()
		await page.locator('.ant-select-dropdown:visible .ant-select-item-option[title="导航分组"]').tap()
		await expect(page).toHaveURL(/settings\/groups/)
		await expect(page.locator('.group-row')).toHaveCount(2)
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
			.toBe(true)
	} finally {
		await context.close()
	}
})

test('public visitors see neither editing controls nor the editing hint', async ({ page }) => {
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({ json: { code: 0, data: { visitMode: 1, user: { id: 1, role: 2 } } } }),
	)
	await home(page, wallpapers.dark)
	await expect(page.locator('.home-edit-hint')).toHaveCount(0)
	await expect(page.locator('.group-actions')).toHaveCount(0)
	await page.locator('.app-link').first().click({ button: 'right' })
	await expect(page.getByRole('menuitem')).toHaveCount(4)
	await expect(page.getByRole('menuitem', { name: '编辑', exact: true })).toHaveCount(0)
	await expect(page.getByRole('menuitem', { name: '删除', exact: true })).toHaveCount(0)
})

test('partial search and monitor failures keep readable neutral retry controls', async ({ page }) => {
	await page.route('**/api/system/moduleConfig/getByName', (route) =>
		route.fulfill({ status: 500, json: { msg: 'Demo failure' } }),
	)
	await home(page, wallpapers.dark, { systemMonitorShow: true })
	await expect(page.locator('.home-page .status-state')).toHaveCount(2)
	for (const state of await page.locator('.home-page .status-state').all()) {
		await expect(state).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		await expect(state.getByRole('button', { name: '重试', exact: true })).toHaveCSS(
			'color',
			'rgb(255, 255, 255)',
		)
	}
	await expect(page.getByRole('button', { name: '导入配置', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: '添加第一个应用', exact: true })).toBeVisible()
})
