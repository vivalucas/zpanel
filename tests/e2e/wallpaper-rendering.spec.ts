import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const svg = (body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900">${body}</svg>`
const wallpapers: Record<string, string> = {
	'gray.svg': svg('<path fill="#909090" d="M0 0h1440v900H0z"/>'),
	'blur-colors.svg':
		'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><path fill="#00c000" d="M0 0h200v400H0z"/><path fill="#ff00ff" d="M200 0h200v400H200z"/></svg>',
	'blur-transparent.svg':
		'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><path fill="#00c000" fill-opacity=".5" d="M0 0h200v400H0z"/><path fill="#ff00ff" fill-opacity=".7" d="M200 0h200v400H200z"/></svg>',
	'gutter-outside.svg':
		'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><path fill="#000" d="M0 0h1600v1000H0z"/><path fill="#fff" d="M86 0h16v1000H86z"/></svg>',
	'dark-highlight.svg': svg(
		'<path fill="#3c4650" d="M0 0h1440v900H0z"/><circle fill="#fff" cx="1200" cy="720" r="8"/>',
	),
	'texture.svg': svg(
		'<defs><pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse"><path fill="#fff" d="M0 0h4v8H0z"/></pattern></defs><path fill="#000" d="M0 0h1440v900H0z"/><path fill="url(#p)" d="M0 0h1440v900H0z"/>',
	),
	'bright.svg': svg('<path fill="#f5f0e5" d="M0 0h1440v900H0z"/>'),
	'dark.svg': svg('<path fill="#14202d" d="M0 0h1440v900H0z"/>'),
	'remote.svg': svg('<path fill="#b48c64" d="M0 0h1440v900H0z"/>'),
	'transparent.svg': svg('<path fill="#ff0000" fill-opacity="0.5" d="M0 0h720v900H0z"/>'),
	'mostly-dark.svg': svg(
		'<path fill="#141414" d="M0 0h1440v900H0z"/><path fill="#fff" d="M600 0h840v180H600z"/>',
	),
	'mostly-light.svg': svg(
		'<path fill="#fafafa" d="M0 0h1440v900H0z"/><path fill="#000" d="M600 0h840v180H600z"/>',
	),
}

interface Scenario {
	customCss?: string
	image?: string
	theme?: 'light' | 'dark'
	panel?: Record<string, unknown>
}

async function fixture(page: Page, scenario: Scenario = {}) {
	const theme = scenario.theme || 'light'
	const panel: Record<string, unknown> = {
		backgroundImageSrc: `/wallpaper-fixture/${scenario.image || 'dark-highlight.svg'}`,
		backgroundMaskNumber: 0,
		backgroundBlur: 0,
		iconStyle: 1,
		marginTop: 2,
		marginBottom: 2,
		logoText: '壁纸测试',
		...scenario.panel,
	}
	const writes: Record<string, unknown>[] = []
	await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
	await page.addInitScript((theme) => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'wallpaper-rendering-fixture',
					theme,
					language: 'zh-CN',
					network: 'wan',
					accounts: [],
					homeEditHintDismissed: true,
				},
			}),
		)
	}, theme)
	// Every API request is intercepted, so these tests cannot read or write a real account.
	await page.route('**/api/**', async (route) => {
		const pathname = new URL(route.request().url()).pathname
		let data: unknown = null
		if (pathname === '/api/user/getAuthInfo') data = { user: { id: 1801, role: 1 }, visitMode: 0 }
		if (pathname === '/api/openness/loginConfig')
			data = { siteSetting: { customCss: scenario.customCss || '' }, loginCaptcha: false }
		if (pathname === '/api/panel/userConfig/get') data = { panel, panelWarnings: [] }
		if (pathname === '/api/panel/itemIconGroup/getNavigation')
			data = [
				{
					id: 1800,
					title: '常用网站',
					items: [
						{
							id: 1802,
							title: '工作空间',
							description: '项目与资料',
							url: 'https://example.test',
							openMethod: 2,
							itemIconGroupId: 1800,
							icon: { itemType: 1, text: 'W' },
						},
					],
				},
			]
		if (pathname === '/api/panel/userConfig/set') {
			const changed = route.request().postDataJSON() as { panel: Record<string, unknown> }
			writes.push(structuredClone(changed.panel))
			Object.assign(panel, changed.panel)
		}
		await route.fulfill({ json: { code: 0, data } })
	})
	await page.route('**/wallpaper-fixture/*', (route) => {
		const name = new URL(route.request().url()).pathname.split('/').at(-1)!
		return wallpapers[name]
			? route.fulfill({ contentType: 'image/svg+xml', body: wallpapers[name] })
			: route.fulfill({ status: 404, body: '' })
	})
	return { panel, writes }
}

async function enterHome(page: Page) {
	await page.goto(`/?wallpaperRendering=${Date.now()}#/`)
	await expect(page.locator('.navigation-group')).toHaveCount(1)
	await page.evaluate(async () => {
		await document.fonts.ready
	})
}

async function pixels(page: Page, target: Locator, points: [number, number][]) {
	const screenshot = await target.screenshot({ animations: 'disabled' })
	return page.evaluate(
		async ({ data, points }) => {
			const image = new Image()
			image.src = `data:image/png;base64,${data}`
			await image.decode()
			const canvas = document.createElement('canvas')
			canvas.width = image.width
			canvas.height = image.height
			const context = canvas.getContext('2d')!
			context.drawImage(image, 0, 0)
			return points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3))
		},
		{ data: screenshot.toString('base64'), points },
	)
}

function textContrast(ink: number[], surface: number[]) {
	const luminance = (rgb: number[]) =>
		rgb.reduce((sum, value, index) => {
			const channel = value / 255
			return (
				sum +
				[0.2126, 0.7152, 0.0722][index] *
					(channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
			)
		}, 0)
	const values = [luminance(ink), luminance(surface)].sort((a, b) => a - b)
	return (values[1] + 0.05) / (values[0] + 0.05)
}

for (const [width, height] of [
	[1000, 700],
	[390, 844],
]) {
	for (const textColor of ['#202733', '#ffffff']) {
		test(`automatic contrast protects actual colored blur pixels for ${textColor} at ${width}x${height}`, async ({
			page,
		}, info) => {
			await page.setViewportSize({ width, height })
			const { panel, writes } = await fixture(page, {
				image: 'blur-colors.svg',
				panel: { backgroundBlur: 30, iconTextColor: textColor, wallpaperAutoContrast: false },
			})
			await enterHome(page)
			const home = page.locator('.home-page')
			await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(home).toHaveCSS('--wallpaper-scrim', '0')
			const mask = page.locator('.home-contrast-mask')
			const bounds = await mask.boundingBox()
			const y = Math.round(bounds!.height * 0.7)
			const points: [number, number][] = Array.from({ length: 41 }, (_, index) => [
				Math.round(1 + ((bounds!.width - 3) * index) / 40),
				y,
			])
			const ink = textColor === '#ffffff' ? [255, 255, 255] : [32, 39, 51]
			const original = await pixels(page, mask, points)
			if (textColor === '#202733')
				expect(textContrast(ink, original[20])).toBeLessThan(3.2)
			panel.wallpaperAutoContrast = true
			await page.reload()
			await expect(home).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(home).not.toHaveCSS('--wallpaper-scrim', '0')
			const protectedPixels = await pixels(page, mask, points)
			for (const surface of protectedPixels)
				expect(textContrast(ink, surface), `rendered ${surface}`).toBeGreaterThanOrEqual(4.5)
			const veil = await mask.evaluate((element) => getComputedStyle(element).backgroundColor)
			await page.screenshot({ path: info.outputPath('colored-blur-home.png'), animations: 'disabled' })
			await page.getByRole('button', { name: '设置', exact: true }).click()
			await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(page.locator('.wallpaper-preview-contrast')).toHaveCSS('background-color', veil)
			expect(writes).toHaveLength(0)
			await page.locator('.wallpaper-preview').screenshot({ path: info.outputPath('colored-blur-preview.png') })
		})
	}
}

for (const theme of ['light', 'dark'] as const) {
	test(`blur analysis includes transparent wallpaper and the ${theme} base`, async ({ page }) => {
		await page.setViewportSize({ width: 1000, height: 700 })
		await fixture(page, {
			image: 'blur-transparent.svg',
			theme,
			panel: {
				backgroundBlur: 30,
				backgroundMaskNumber: 0.25,
				iconTextColor: '#202733',
				wallpaperAutoContrast: true,
			},
		})
		await enterHome(page)
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		const mask = page.locator('.home-contrast-mask')
		const bounds = await mask.boundingBox()
		const points: [number, number][] = Array.from({ length: 41 }, (_, index) => [
			Math.round(1 + ((bounds!.width - 3) * index) / 40),
			Math.round(bounds!.height * 0.7),
		])
		for (const surface of await pixels(page, mask, points))
			expect(textContrast([32, 39, 51], surface)).toBeGreaterThanOrEqual(4.5)
	})
}

test('unsupported canvas blur uses the explicit analysis fallback instead of unblurred colors', async ({
	page,
}) => {
	await page.addInitScript(() => {
		Reflect.deleteProperty(CanvasRenderingContext2D.prototype, 'filter')
	})
	await fixture(page, {
		image: 'blur-colors.svg',
		panel: { backgroundBlur: 30, iconTextColor: '#202733', wallpaperAutoContrast: true },
	})
	await enterHome(page)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'unreadable')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0.68')
	await expect(page.locator('.home-background')).toHaveCSS('filter', 'blur(30px)')
})

for (const image of ['dark-highlight.svg', 'texture.svg']) {
	test(`legacy zero darkness preserves actual ${image} pixels without an automatic veil`, async ({
		page,
	}, info) => {
		await page.setViewportSize({ width: 1440, height: 900 })
		const { panel, writes } = await fixture(page, { image, theme: 'dark' })
		expect(panel).not.toHaveProperty('wallpaperAutoContrast')
		await enterHome(page)
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		const points: [number, number][] =
			image === 'dark-highlight.svg'
				? [
						[1000, 650],
						[1200, 720],
					]
				: [
						[1001, 650],
						[1005, 650],
					]
		const expected =
			image === 'dark-highlight.svg'
				? [
						[60, 70, 80],
						[255, 255, 255],
					]
				: [
						[255, 255, 255],
						[0, 0, 0],
					]
		expect(await pixels(page, page.locator('.home-page'), points)).toEqual(expected)
		expect(writes).toHaveLength(0)
		await page.screenshot({ path: info.outputPath(`${image}-zero-darkness.png`), animations: 'disabled' })
	})
}

test('a displayable remote wallpaper keeps its pixels when CORS prevents analysis', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	const source = 'https://wallpaper.test/remote.svg'
	await fixture(page, { panel: { backgroundImageSrc: source } })
	await page.route(source, (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: wallpapers['remote.svg'],
			headers: { 'access-control-allow-origin': 'https://different.test' },
		}),
	)
	await enterHome(page)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'unreadable')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
	expect(await pixels(page, page.locator('.home-page'), [[1000, 650]])).toEqual([[180, 140, 100]])
	await page.screenshot({
		path: info.outputPath('remote-uninspectable-original.png'),
		animations: 'disabled',
	})
})

test('a broken wallpaper falls back to the theme without deleting its configured address', async ({
	page,
}, info) => {
	const source = '/wallpaper-fixture/missing.svg'
	const { panel, writes } = await fixture(page, {
		theme: 'dark',
		panel: {
			backgroundImageSrc: source,
			backgroundMaskNumber: 0.7,
			wallpaperAutoContrast: true,
		},
	})
	await enterHome(page)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'error')
	await expect(page.locator('.home-page')).not.toHaveClass(/has-wallpaper/)
	await expect(page.locator('.home-background')).toHaveCSS('background-image', 'none')
	await expect(page.locator('.home-mask, .home-contrast-mask')).toHaveCount(0)
	await page.getByRole('button', { name: '设置', exact: true }).click()
	await expect(page.locator('#backgroundImageSrc')).toHaveValue(source)
	await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'error')
	expect(panel.backgroundImageSrc).toBe(source)
	expect(writes).toHaveLength(0)
	await page.screenshot({ path: info.outputPath('broken-wallpaper-settings.png'), animations: 'disabled' })
})

test('large windows use bounded color sampling and never receive a default blackout', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 4096, height: 2160 })
	await page.addInitScript(() => {
		const sizes: number[][] = []
		Object.assign(window, { wallpaperCanvasSizes: sizes })
		const original = HTMLCanvasElement.prototype.getContext
		Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
			value(this: HTMLCanvasElement, type: string, options?: Record<string, unknown>) {
				if (options?.willReadFrequently) sizes.push([this.width, this.height])
				return Reflect.apply(original, this, [type, options])
			},
		})
	})
	await fixture(page)
	await enterHome(page)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
	const sizes = await page.evaluate(
		() => (window as typeof window & { wallpaperCanvasSizes: number[][] }).wallpaperCanvasSizes,
	)
	expect(sizes.length).toBeGreaterThan(0)
	for (const [width, height] of sizes) expect(width * height).toBeLessThanOrEqual(262_144)
	await page.screenshot({
		path: info.outputPath('large-window-wallpaper.png'),
		clip: { x: 3400, y: 1700, width: 300, height: 250 },
		animations: 'disabled',
	})
})

for (const theme of ['light', 'dark'] as const) {
	test(`transparent wallpaper composites with its real ${theme} base without a fallback veil`, async ({
		page,
	}, info) => {
		await page.setViewportSize({ width: 1440, height: 900 })
		await fixture(page, { image: 'transparent.svg', theme })
		await enterHome(page)
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
		const base = await page.locator('.home-background').evaluate((element) =>
			getComputedStyle(element)
				.backgroundColor.match(/[\d.]+/g)!
				.slice(0, 3)
				.map(Number),
		)
		const actual = await pixels(page, page.locator('.home-page'), [
			[500, 650],
			[1000, 650],
		])
		expect(actual[1]).toEqual(base)
		const expected = base.map((value, index) => (value + (index === 0 ? 255 : 0)) / 2)
		for (let channel = 0; channel < 3; channel++)
			expect(Math.abs(actual[0][channel] - expected[channel])).toBeLessThanOrEqual(1)
		await page.screenshot({
			path: info.outputPath(`transparent-wallpaper-${theme}.png`),
			animations: 'disabled',
		})
	})
}

test('late results from a previous wallpaper cannot replace the current draft colors', async ({
	page,
}, info) => {
	const { writes } = await fixture(page, { image: 'bright.svg', panel: { wallpaperAutoContrast: true } })
	let release!: () => void
	let started = false
	let delivered = false
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/wallpaper-fixture/slow.svg', async (route) => {
		started = true
		await gate
		await route.fulfill({ contentType: 'image/svg+xml', body: wallpapers['dark.svg'] })
		delivered = true
	})
	await page.goto('/#/settings/appearance')
	await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
	const address = page.locator('#backgroundImageSrc')
	try {
		await address.fill('/wallpaper-fixture/slow.svg')
		await expect.poll(() => started).toBe(true)
		await address.fill('/wallpaper-fixture/bright.svg')
		await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-tone', 'dark')
	} finally {
		release()
	}
	await expect.poll(() => delivered).toBe(true)
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
	)
	await expect
		.poll(() =>
			page.locator('.wallpaper-preview-contrast').evaluate((element) =>
				Number(
					getComputedStyle(element)
						.backgroundColor.match(/[\d.]+/g)
						?.at(-1),
				),
			),
		)
		.toBeGreaterThan(0.5)
	await expect(address).toHaveValue('/wallpaper-fixture/bright.svg')
	await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-tone', 'dark')
	await expect(page.locator('.wallpaper-preview-image')).toHaveCSS('background-image', /bright\.svg/)
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)?.backgroundImageSrc).toBe('/wallpaper-fixture/bright.svg')
	await page.screenshot({ path: info.outputPath('latest-wallpaper-draft.png'), animations: 'disabled' })
})

test('automatic contrast is a saved choice and preview and home render the same masks', async ({
	page,
}, info) => {
	const { writes } = await fixture(page, { image: 'texture.svg', panel: { backgroundMaskNumber: 0.15 } })
	await page.goto('/#/settings/appearance')
	const preview = page.locator('.wallpaper-preview')
	await expect(preview).toHaveAttribute('data-wallpaper-status', 'ready')
	const toggle = page.getByRole('switch', { name: '自动调整壁纸对比度', exact: true })
	await expect(toggle).not.toBeChecked()
	await toggle.check()
	await expect(preview).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect
		.poll(() =>
			page.locator('.wallpaper-preview-contrast').evaluate((element) => {
				const components = getComputedStyle(element)
					.backgroundColor.match(/[\d.]+/g)!
					.map(Number)
				return components.length === 4 ? components[3] : 1
			}),
		)
		.toBeGreaterThan(0)
	const previewMasks = await page
		.locator('.wallpaper-preview-shade, .wallpaper-preview-contrast')
		.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor))
	await page.screenshot({ path: info.outputPath('automatic-wallpaper-preview.png'), animations: 'disabled' })
	await expect.poll(() => writes.length).toBe(1)
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes[0].wallpaperAutoContrast).toBe(true)
	await expect(page.locator('.settings-draft-hint')).toHaveCount(0)
	await page.getByRole('button', { name: '返回首页', exact: true }).click()
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	expect(
		await page
			.locator('.home-mask, .home-contrast-mask')
			.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor)),
	).toEqual(previewMasks)
	await page.getByRole('button', { name: '设置', exact: true }).click()
	await expect(toggle).toBeChecked()
	await toggle.uncheck()
	expect(writes).toHaveLength(1)
	await expect.poll(() => writes.length).toBe(2)
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes[1].wallpaperAutoContrast).toBe(false)
	await expect(page.locator('.settings-draft-hint')).toHaveCount(0)
	await page.getByRole('button', { name: '返回首页', exact: true }).click()
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
})

test('existing control surfaces protect their text independently of extreme wallpaper patches', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	for (const image of ['mostly-dark.svg', 'mostly-light.svg']) {
		await page.unroute('**/api/**')
		await page.unroute('**/wallpaper-fixture/*')
		await fixture(page, { image, panel: { iconStyle: 2 } })
		await enterHome(page)
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		const ratios = await page
			.locator('.search-box, .home-tools, .navigation-card')
			.evaluateAll((elements) => {
				const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number)
				const luminance = (rgb: number[]) =>
					rgb.slice(0, 3).reduce((sum, value, index) => {
						const n = value / 255
						return (
							sum +
							[0.2126, 0.7152, 0.0722][index] * (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
						)
					}, 0)
				return elements.map((element) => {
					const surface = rgba(getComputedStyle(element).backgroundColor)
					const foreground = rgba(
						getComputedStyle(element.querySelector('input, button, a') || element).color,
					)
					const worst = luminance(foreground) > 0.5 ? 255 : 0
					const alpha = surface.length === 4 ? surface[3] : 1
					const background = luminance(
						surface.slice(0, 3).map((channel) => channel * alpha + worst * (1 - alpha)),
					)
					const ink = luminance(foreground)
					return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05)
				})
			})
		expect(ratios.length).toBeGreaterThanOrEqual(3)
		for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
		await page.screenshot({ path: info.outputPath(`${image}-control-surfaces.png`), animations: 'disabled' })
	}
})

test('explicit automatic contrast retains a protected fallback for an uninspectable remote image', async ({
	page,
}, info) => {
	const source = 'https://wallpaper.test/automatic-remote.svg'
	const { writes } = await fixture(page, {
		panel: { backgroundImageSrc: source, wallpaperAutoContrast: true },
	})
	await page.route(source, (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: wallpapers['remote.svg'],
			headers: { 'access-control-allow-origin': 'https://different.test' },
		}),
	)
	await enterHome(page)
	const home = page.locator('.home-page')
	await expect(home).toHaveAttribute('data-wallpaper-status', 'unreadable')
	await expect(home).toHaveAttribute('data-wallpaper-tone', 'dark')
	await expect(home).toHaveCSS('--wallpaper-scrim', '0.68')
	await expect(page.locator('.home-background')).toHaveCSS('background-image', /automatic-remote\.svg/)
	expect(writes).toHaveLength(0)
	await page.screenshot({
		path: info.outputPath('automatic-remote-protected-fallback.png'),
		animations: 'disabled',
	})
})

test('restoring appearance defaults requires confirmation then saves automatically', async ({
	page,
}, info) => {
	const { panel, writes } = await fixture(page, {
		image: 'texture.svg',
		panel: { wallpaperAutoContrast: true },
	})
	await page.goto('/#/settings/appearance')
	const toggle = page.getByRole('switch', { name: '自动调整壁纸对比度', exact: true })
	await expect(toggle).toBeChecked()
	await page.getByRole('button', { name: '恢复默认值', exact: true }).click()
	const confirmation = page.getByRole('dialog')
	await expect(confirmation).toContainText('将首页外观设置恢复默认值？')
	expect(writes).toHaveLength(0)
	expect(panel.wallpaperAutoContrast).toBe(true)
	await confirmation.getByRole('button', { name: '确定', exact: true }).click()
	await expect(confirmation).toHaveCount(0)
	await expect(toggle).not.toBeChecked()
	await expect.poll(() => writes.length).toBe(1)
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes[0].wallpaperAutoContrast).toBe(false)
	expect(panel.wallpaperAutoContrast).toBe(false)
	await expect(page.locator('.settings-draft-hint')).toHaveCount(0)
	await page.reload()
	await expect(toggle).not.toBeChecked()
	await page.screenshot({
		path: info.outputPath('restored-default-wallpaper-choice.png'),
		animations: 'disabled',
	})
})

test('higher contrast preferences give preview and home the same opaque control and icon surfaces', async ({
	page,
}, info) => {
	const scenarios = [
		{
			theme: 'dark',
			image: 'bright.svg',
			tone: 'light',
			panel: { iconTextColor: '#202733' },
		},
		{
			theme: 'light',
			image: 'dark.svg',
			tone: 'dark',
			panel: { iconTextColor: '#ffffff' },
		},
	] as const
	for (const scenario of scenarios) {
		await page.unroute('**/api/**')
		await page.unroute('**/wallpaper-fixture/*')
		await fixture(page, scenario)
		await page.emulateMedia({ colorScheme: scenario.theme, reducedMotion: 'reduce', contrast: 'more' })
		await enterHome(page)
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-tone', scenario.tone)
		const homeSurfaces = await page
			.locator('.search-box, .item-icon')
			.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor))
		const systemColors = await page.evaluate(() => {
			const probe = document.createElement('span')
			probe.style.cssText = 'background:Canvas;color:CanvasText'
			document.body.append(probe)
			const style = getComputedStyle(probe)
			const colors = { surface: style.backgroundColor, text: style.color }
			probe.remove()
			return colors
		})
		expect(homeSurfaces).toEqual([systemColors.surface, systemColors.surface])
		for (const element of await page.locator('.home-logo-text, .group-heading h2, .app-copy strong').all()) {
			await expect(element).toHaveCSS('color', systemColors.text)
			await expect(element).toHaveCSS('-webkit-text-stroke-width', '0px')
			await expect(element).toHaveCSS('text-shadow', 'none')
		}
		await expect(page.locator('.home-background')).toHaveCSS('visibility', 'hidden')
		await page.getByRole('button', { name: '设置', exact: true }).click()
		await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-tone', scenario.tone)
		const previewSurfaces = await page
			.locator('.wallpaper-preview-search, .wallpaper-preview-icon')
			.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor))
		expect(previewSurfaces).toEqual([homeSurfaces[0], homeSurfaces[1], homeSurfaces[1]])
		await page.screenshot({
			path: info.outputPath(`higher-contrast-${scenario.tone}-preview.png`),
			animations: 'disabled',
		})
	}
})

test('explicit black text stays readable on middle gray without changing wallpaper pixels', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	await fixture(page, { image: 'gray.svg', theme: 'dark', panel: { iconTextColor: '#202733' } })
	await enterHome(page)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
	const ratio = await page.locator('.group-heading h2').evaluate((element) => {
		const ink = getComputedStyle(element)
			.color.match(/[\d.]+/g)!
			.slice(0, 3)
			.map(Number)
		const luminance = (rgb: number[]) =>
			rgb.reduce((sum, value, i) => {
				const s = value / 255
				return sum + [0.2126, 0.7152, 0.0722][i] * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)
			}, 0)
		const values = [luminance(ink), luminance([144, 144, 144])].sort((a, b) => a - b)
		return (values[1] + 0.05) / (values[0] + 0.05)
	})
	expect(ratio).toBeGreaterThanOrEqual(4.5)
	expect(await pixels(page, page.locator('.home-page'), [[1000, 650]])).toEqual([[144, 144, 144]])
	await page.screenshot({
		path: info.outputPath('middle-gray-readable-original.png'),
		animations: 'disabled',
	})
})

test('stable scrollbar gutters use the displayed cover crop in home and preview', async ({ page }, info) => {
	await page.setViewportSize({ width: 1000, height: 700 })
	await fixture(page, {
		image: 'gutter-outside.svg',
		customCss: 'html { overflow-y: scroll; scrollbar-gutter: stable both-edges; }',
		panel: { wallpaperAutoContrast: true },
	})
	await enterHome(page)
	const bounds = await page.locator('.home-background').boundingBox()
	expect(bounds!.width).toBeLessThan(1000)
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-tone', 'dark')
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-mixed', 'false')
	await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
	await page.screenshot({ path: info.outputPath('scrollbar-crop-home.png'), animations: 'disabled' })
	await page.getByRole('button', { name: '设置', exact: true }).click()
	const preview = page.locator('.wallpaper-preview')
	await expect(preview).toHaveAttribute('data-wallpaper-status', 'ready')
	await expect(preview).toHaveAttribute('data-wallpaper-tone', 'dark')
	await expect(preview).toHaveAttribute('data-wallpaper-mixed', 'false')
	const previewBounds = await preview.boundingBox()
	expect(previewBounds!.width / previewBounds!.height).toBeCloseTo(bounds!.width / bounds!.height, 3)
	await preview.screenshot({ path: info.outputPath('scrollbar-crop-preview.png'), animations: 'disabled' })
})
