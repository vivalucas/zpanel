import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

interface IconItem {
	id: number
	title: string
	url: string
	openMethod: number
	itemIconGroupId: number
	description: string
	icon: { itemType: number; src: string; text?: string; backgroundColor: string }
}
interface Scenario {
	theme?: 'light' | 'dark'
	language?: 'zh-CN' | 'en-US'
	wallpaper?: boolean
	wallpaperImage?: string
	glassProbe?: boolean
	symbolProbe?: boolean
	autoContrast?: boolean
	iconStyle?: number
}

const svg = (width: number, height: number, body: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
const fixtures: Record<string, string> = {
	'square.svg': svg(96, 96, '<path fill="#5266eb" d="M0 0h96v96H0z"/><path d="M30 28h36L30 68h36" fill="none" stroke="white" stroke-width="8"/>'),
	'google.svg': svg(96, 96, '<path d="M70 31a29 29 0 1 0 6 33H49V48h42v9A43 43 0 1 1 79 19z" fill="#4285f4"/><path d="M16 31a42 42 0 0 1 63-12L68 31a27 27 0 0 0-39 10z" fill="#ea4335"/><path d="M16 31l13 10a28 28 0 0 0 0 18L16 69a42 42 0 0 1 0-38" fill="#fbbc05"/><path d="M16 69l13-10a28 28 0 0 0 39 9l12 11a42 42 0 0 1-64-10" fill="#34a853"/>'),
	'bing.svg': svg(96, 96, '<defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#39d1f5"/><stop offset="1" stop-color="#176bde"/></linearGradient></defs><path fill="#19104d" d="M0 0h96v96H0z"/><path fill="url(#b)" d="M25 7l20 14v41l22-13-16-8V24l27 16c13 8 13 22 0 30L40 91 25 81z"/>'),
	'wide.svg': svg(120, 40, '<path fill="#46b47a" d="M0 0h120v40H0z"/><path fill="#ef4444" d="M0 0h16v40H0z"/><path fill="#2563eb" d="M104 0h16v40h-16z"/>'),
	'tall.svg': svg(40, 120, '<path fill="#46b47a" d="M0 0h40v120H0z"/><path fill="#ef4444" d="M0 0h40v16H0z"/><path fill="#2563eb" d="M0 104h40v16H0z"/>'),
	'glass-probe.svg': svg(96, 96, '<path fill="#54c6ff" d="M36 36h24v24H36z"/>'),
}
const wallpaper = svg(1600, 1000, '<defs><linearGradient id="w" x2="1" y2="1"><stop stop-color="#51551c"/><stop offset=".5" stop-color="#17394a"/><stop offset="1" stop-color="#266841"/></linearGradient></defs><path fill="url(#w)" d="M0 0h1600v1000H0z"/>')
const stripedWallpaper = (low: string, high: string, mixed = false) => svg(1600, 1000,
	`<defs><pattern id="stripes" width="8" height="8" patternUnits="userSpaceOnUse"><path fill="${low}" d="M0 0h8v8H0z"/><path fill="${high}" d="M4 0h4v8H4z"/></pattern></defs><path fill="url(#stripes)" d="M0 0h1600v1000H0z"/>${mixed ? '<path fill="#f5efd8" d="M800 0h800v1000H800z"/>' : ''}`,
)
const png = readFileSync('public/logo.png')
const app = (page: Page, title: string) => page.getByRole('link', { name: title, exact: true })
const icon = (page: Page, title: string) => app(page, title).locator('.item-icon')
const labels = {
	'zh-CN': { add: '添加项目', edit: '编辑', title: '标题', url: '地址', type: '图标类型', image: '图片图标', source: '输入图标地址或上传', background: '图标背景色', save: '确定' },
	'en-US': { add: 'Add item', edit: 'Edit', title: 'Title', url: 'URL', type: 'Icon type', image: 'Image icon', source: 'Enter icon URL or upload an image', background: 'Icon background', save: 'OK' },
}

async function home(page: Page, scenario: Scenario = {}) {
	const entries = [
		['ZPanel', 'zpanel.png', ''],
		['满版图标', 'square.svg', ''],
		['谷歌', 'google.svg', ''],
		['必应', 'bing.svg', ''],
		['横向标志', 'wide.svg', ''],
		['纵向标志', 'tall.svg', ''],
		['白色底座', 'google.svg', '#ffffff'],
		['品牌底色', 'google.svg', '#f05a67'],
		['Broken icon', 'missing.svg', ''],
	]
	if (scenario.glassProbe) entries.unshift(['Glass probe', 'glass-probe.svg', ''])
	const items: IconItem[] = entries.map(([title, file, backgroundColor], index) => ({
		id: 8701 + index, title, url: 'https://example.test/app', openMethod: 2,
		itemIconGroupId: 8700, description: '图片保持比例，底座按配置展示',
		icon: { itemType: 2, src: `/icon-fixture/${file}`, backgroundColor },
	}))
	if (scenario.symbolProbe) items.unshift({
		id: 8699, title: 'Text probe', url: 'https://example.test/text', openMethod: 2,
		itemIconGroupId: 8700, description: '文字图标对比探针',
		icon: { itemType: 1, src: '', text: 'W', backgroundColor: '' },
	})
	const writes: IconItem[] = []
	const language = scenario.language || 'zh-CN'
	const theme = scenario.theme || 'light'
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
	await page.addInitScript(() => {
		const params = new URLSearchParams(location.search)
		localStorage.setItem('zpanel-preferences', JSON.stringify({ version: 1, state: {
			token: 'item-icons-fixture', accounts: [], theme: params.get('iconTheme') || 'light',
			language: params.get('iconLanguage') || 'zh-CN', network: 'wan', homeEditHintDismissed: true,
		} }))
	})
	// All API requests stay in this fixture, including writes. No login or live data is needed.
	await page.route('**/api/**', async (route) => {
		const pathname = new URL(route.request().url()).pathname
		let data: unknown = null
		if (pathname === '/api/user/getAuthInfo') data = { user: { id: 87, role: 2 }, visitMode: 0 }
		if (pathname === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		if (pathname === '/api/panel/userConfig/get') data = { panel: {
			iconStyle: scenario.iconStyle || 1, marginTop: 2, marginBottom: 2, searchBoxShow: false,
			backgroundImageSrc: scenario.wallpaper ? '/icon-fixture/wallpaper.svg' : '',
			backgroundMaskNumber: 0,
			backgroundBlur: 0,
			wallpaperAutoContrast: scenario.autoContrast || false,
		}, panelWarnings: [] }
		if (pathname === '/api/panel/itemIconGroup/getNavigation') data = [{ id: 8700, title: 'Icon gallery', items }]
		if (pathname === '/api/panel/itemIcon/edit') {
			const changed = route.request().postDataJSON() as IconItem
			writes.push(changed)
			const index = items.findIndex((item) => item.id === changed.id)
			if (index >= 0) items[index] = { ...items[index], ...changed }
			else items.push({ ...changed, id: 8800 + writes.length })
		}
		await route.fulfill({ json: { code: 0, data } })
	})
	await page.route('**/icon-fixture/*', (route) => {
		const file = new URL(route.request().url()).pathname.split('/').at(-1)!
		if (file === 'zpanel.png') return route.fulfill({ contentType: 'image/png', body: png })
		const body = file === 'wallpaper.svg' ? scenario.wallpaperImage || wallpaper : fixtures[file]
		return body ? route.fulfill({ contentType: 'image/svg+xml', body }) : route.fulfill({ status: 404, body: '' })
	})
	await page.goto(`/?iconTheme=${theme}&iconLanguage=${language}&iconFixture=${Date.now()}#/`)
	await expect(page.locator('.navigation-card')).toHaveCount(items.length)
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
	await expect(icon(page, 'Broken icon').locator('img')).toHaveCount(0)
	await expect(icon(page, 'Broken icon')).toHaveText('BR')
	await expect.poll(() => page.locator('.app-link .item-icon img').evaluateAll((images) =>
		images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
	)).toBe(true)
	await page.evaluate(async () => { await document.fonts.ready })
	return { writes, names: labels[language] }
}

async function edit(page: Page, title: string, editLabel = '编辑') {
	await app(page, title).click({ button: 'right' })
	await page.getByRole('menuitem', { name: editLabel, exact: true }).click()
	const dialog = page.locator('.item-editor-modal')
	await expect(dialog).toBeVisible()
	return dialog
}

async function save(dialog: Locator, name = '确定') {
	await dialog.locator('.item-editor-footer').getByRole('button', { name, exact: true }).click()
	await expect(dialog).toHaveCount(0)
}

async function sample(page: Page, target: Locator, points: [number, number][], path?: string) {
	const screenshot = await target.screenshot({ animations: 'disabled', path })
	return page.evaluate(async ({ data, points }) => {
		const image = new Image()
		image.src = `data:image/png;base64,${data}`
		await image.decode()
		const canvas = document.createElement('canvas')
		canvas.width = image.width
		canvas.height = image.height
		const context = canvas.getContext('2d')!
		context.drawImage(image, 0, 0)
		return points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3))
	}, { data: screenshot.toString('base64'), points })
}

function textureStats(pixels: number[][], rowWidth: number) {
	const luminances = pixels.map(([red, green, blue]) => red * 0.2126 + green * 0.7152 + blue * 0.0722)
	const differences = luminances.flatMap((value, index) => index % rowWidth ? [Math.abs(value - luminances[index - 1])] : [])
	return {
		meanLuminance: luminances.reduce((sum, value) => sum + value, 0) / luminances.length,
		texture: differences.reduce((sum, value) => sum + value, 0) / differences.length,
	}
}

function relativeLuminance(color: number[]) {
	return color.reduce((sum, value, index) => {
		const channel = value / 255
		return sum + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
	}, 0)
}

async function renderedTextContrast(page: Page, target: Locator, path: string) {
	// Use the glyph's line box rather than the whole tile: the protective surface may only wrap text.
	const points = await target.evaluate((element) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
		})
		const text = walker.nextNode()
		if (!text) throw new Error('Expected a visible text or failed-image fallback glyph')
		const range = document.createRange()
		range.selectNodeContents(text)
		const glyph = range.getBoundingClientRect()
		const tile = element.getBoundingClientRect()
		const samples: [number, number][] = []
		for (let y = Math.max(0, Math.ceil(glyph.top - tile.top)); y < Math.min(tile.height, Math.floor(glyph.bottom - tile.top)); y++)
			for (let x = Math.max(0, Math.ceil(glyph.left - tile.left)); x < Math.min(tile.width, Math.floor(glyph.right - tile.left)); x++) samples.push([x, y])
		return samples
	})
	expect(points.length).toBeGreaterThan(100)
	const pixels = await sample(page, target, points, path)
	const colors = new Map<string, { color: number[]; count: number }>()
	for (const color of pixels) {
		const key = color.join(',')
		const entry = colors.get(key)
		if (entry) entry.count++
		else colors.set(key, { color, count: 1 })
	}
	const ranked = [...colors.values()].sort((left, right) => right.count - left.count)
	const background = ranked[0].color
	const distance = (color: number[]) => color.reduce((sum, value, index) => sum + (value - background[index]) ** 2, 0)
	// Uniform fixtures leave the line-box background dominant; the furthest real pixel is solid glyph ink.
	const foreground = ranked.reduce((best, entry) => distance(entry.color) > distance(best) ? entry.color : best, background)
	const luminances = [relativeLuminance(background), relativeLuminance(foreground)].sort((left, right) => left - right)
	return { background, foreground, contrast: (luminances[1] + 0.05) / (luminances[0] + 0.05) }
}

test('square images fill their tile without an added white ring', async ({ page }, info) => {
	await home(page, { wallpaper: true, theme: 'dark' })
	const tile = icon(page, '满版图标')
	const colors = await sample(page, tile, [[3, 35], [66, 35], [35, 3], [35, 66]])
	for (const color of colors) expect(color).toEqual([82, 102, 235])
	const outer = await tile.boundingBox()
	const image = await tile.locator('img').boundingBox()
	expect(outer).not.toBeNull()
	expect(image).not.toBeNull()
	expect(image!.width).toBeCloseTo(outer!.width, 0)
	expect(image!.height).toBeCloseTo(outer!.height, 0)
	await page.screenshot({ path: info.outputPath('filled-square-and-transparent-logos.png'), animations: 'disabled' })
})

test('wide and tall marks retain their shape and both ends without cropping', async ({ page }) => {
	await home(page, { wallpaper: true, theme: 'dark' })
	const wide = await sample(page, icon(page, '横向标志'), [[4, 35], [65, 35], [35, 13]])
	const tall = await sample(page, icon(page, '纵向标志'), [[35, 4], [35, 65], [13, 35]])
	for (const colors of [wide, tall]) {
		expect(colors[0]).toEqual([239, 68, 68])
		expect(colors[1]).toEqual([37, 99, 235])
		expect(colors[2]).not.toEqual([70, 180, 122])
	}
	const background = await icon(page, '谷歌').evaluate((element) => {
		const style = getComputedStyle(element)
		return { background: style.backgroundColor, blur: style.backdropFilter }
	})
	expect(background.background).toMatch(/^rgba\(/)
	expect(background.blur).toContain('blur(')
})

test('transparent logos transmit dark, light and mixed wallpaper while their glass softens actual texture', async ({ page }, info) => {
	test.setTimeout(60_000)
	await page.setViewportSize({ width: 1440, height: 1000 })
	const scenarios = [
		{ name: 'dark', theme: 'light', image: stripedWallpaper('#1c394d', '#4c718e') },
		{ name: 'light', theme: 'dark', image: stripedWallpaper('#b4d4c0', '#fff4d6') },
		{ name: 'mixed', theme: 'dark', image: stripedWallpaper('#1c394d', '#4c718e', true) },
	] as const
	// This strip lies above the small opaque mark and inside the rounded tile's edges.
	const points: [number, number][] = []
	for (let y = 14; y < 22; y++) for (let x = 18; x < 50; x++) points.push([x, y])
	const measurements = []
	for (const scenario of scenarios) {
		const { writes } = await home(page, {
			theme: scenario.theme, wallpaper: true, wallpaperImage: scenario.image, glassProbe: true,
		})
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		await page.mouse.move(1, 1)
		const tile = icon(page, 'Glass probe')
		const originalStyle = await tile.getAttribute('style')
		const frosted = textureStats(await sample(page, tile, points, info.outputPath(`${scenario.name}-frosted.png`)), 32)
		let unblurred: ReturnType<typeof textureStats>
		let bare: ReturnType<typeof textureStats>
		try {
			await tile.evaluate((element) => {
				const style = (element as HTMLElement).style
				style.setProperty('-webkit-backdrop-filter', 'none', 'important')
				style.setProperty('backdrop-filter', 'none', 'important')
			})
			unblurred = textureStats(await sample(page, tile, points, info.outputPath(`${scenario.name}-unblurred.png`)), 32)
			await tile.evaluate((element) => {
				const style = (element as HTMLElement).style
				style.setProperty('background', 'transparent', 'important')
				style.setProperty('box-shadow', 'none', 'important')
			})
			bare = textureStats(await sample(page, tile, points, info.outputPath(`${scenario.name}-bare-wallpaper.png`)), 32)
		} finally {
			await tile.evaluate((element, style) => {
				if (style === null) element.removeAttribute('style')
				else element.setAttribute('style', style)
			}, originalStyle)
		}
		measurements.push({ wallpaper: scenario.name, frosted, unblurred, bare })
		// An opaque tile cannot pass by hiding all texture: most light must still transmit without blur.
		expect(bare.texture, `${scenario.name}: fixture texture is visible`).toBeGreaterThan(3)
		expect(unblurred.texture, `${scenario.name}: surface remains translucent`).toBeGreaterThan(bare.texture * 0.7)
		expect(frosted.texture, `${scenario.name}: blur visibly softens the wallpaper`).toBeLessThan(unblurred.texture * 0.45)
		expect(frosted.meanLuminance, `${scenario.name}: surface does not become a dark block`).toBeGreaterThan(bare.meanLuminance * 0.9 - 2)
		expect(writes).toHaveLength(0)
	}
	await info.attach('glass-surface-pixels', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
})

test('text and failed-image glyphs keep 4.5 contrast on a middle-gray automatically adjusted wallpaper', async ({ page }, info) => {
	const { writes } = await home(page, {
		theme: 'dark', wallpaper: true, symbolProbe: true, autoContrast: true,
		wallpaperImage: svg(1600, 1000, '<path fill="#6d6d6d" d="M0 0h1600v1000H0z"/>'),
	})
	await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
	const measurements = []
	for (const name of ['Text probe', 'Broken icon']) {
		const tile = icon(page, name)
		await expect(tile).toHaveText(name === 'Text probe' ? 'W' : 'BR')
		const pixels = await renderedTextContrast(page, tile, info.outputPath(`gray-wallpaper-${name === 'Text probe' ? 'text' : 'fallback'}.png`))
		measurements.push({ name, ...pixels })
		expect(pixels.contrast, `${name}: real glyph and its immediate background`).toBeGreaterThanOrEqual(4.5)
	}
	expect(writes).toHaveLength(0)
	await info.attach('gray-wallpaper-symbol-contrast', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
})

test('forced colors alone use readable solid icon surfaces without blur in both themes and wallpaper modes', async ({ page }, info) => {
	test.setTimeout(60_000)
	const measurements = []
	for (const theme of ['light', 'dark'] as const) {
		for (const hasWallpaper of [false, true]) {
			const { writes } = await home(page, {
				theme, wallpaper: hasWallpaper, symbolProbe: true,
				wallpaperImage: svg(1600, 1000, '<path fill="#6d6d6d" d="M0 0h1600v1000H0z"/>'),
			})
			await page.emulateMedia({ forcedColors: 'active', contrast: 'no-preference' })
			expect(await page.evaluate(() => ({ forced: matchMedia('(forced-colors: active)').matches, contrast: matchMedia('(prefers-contrast: more)').matches }))).toEqual({ forced: true, contrast: false })
			const mode = `${theme}-${hasWallpaper ? 'wallpaper' : 'plain'}`
			for (const name of ['Text probe', 'Broken icon']) {
				const tile = icon(page, name)
				await expect(tile).toHaveCSS('backdrop-filter', 'none')
				const alpha = await tile.evaluate((element) => {
					const canvas = document.createElement('canvas')
					canvas.width = canvas.height = 1
					const context = canvas.getContext('2d')!
					context.fillStyle = getComputedStyle(element).backgroundColor
					context.fillRect(0, 0, 1, 1)
					return context.getImageData(0, 0, 1, 1).data[3]
				})
				expect(alpha, `${mode}: solid accessible surface`).toBe(255)
				const pixels = await renderedTextContrast(page, tile, info.outputPath(`forced-colors-${mode}-${name === 'Text probe' ? 'text' : 'fallback'}.png`))
				measurements.push({ theme, hasWallpaper, name, alpha, ...pixels })
				expect(pixels.contrast, `${mode} ${name}: real text contrast`).toBeGreaterThanOrEqual(4.5)
			}
			expect(writes).toHaveLength(0)
		}
	}
	await info.attach('forced-colors-symbol-contrast', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
})

test('existing background colors survive saves and clearing opts back into glass', async ({ page }, info) => {
	const { writes } = await home(page, { wallpaper: true, theme: 'dark' })
	await expect(icon(page, '白色底座')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
	await expect(icon(page, '品牌底色')).toHaveCSS('background-color', 'rgb(240, 90, 103)')
	let dialog = await edit(page, '白色底座')
	await expect(dialog.getByRole('textbox', { name: '图标背景色', exact: true })).toHaveValue('#ffffff')
	await expect(dialog.locator('.item-editor-icon-preview .item-icon')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
	await save(dialog)
	expect(writes[0].icon.backgroundColor).toBe('#ffffff')
	await expect(icon(page, '白色底座')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
	dialog = await edit(page, '白色底座')
	const field = dialog.getByRole('textbox', { name: '图标背景色', exact: true })
	await field.locator('..').locator('.ant-input-clear-icon').click()
	await expect(field).toHaveValue('')
	await expect(dialog.locator('.item-editor-icon-preview .item-icon')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)')
	await page.screenshot({ path: info.outputPath('cleared-background-preview.png'), animations: 'disabled' })
	await save(dialog)
	expect(writes[1].icon.backgroundColor).toBe('')
	await expect(icon(page, '白色底座')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)')
	await expect(icon(page, '品牌底色')).toHaveCSS('background-color', 'rgb(240, 90, 103)')
})

test('a failed image recovers immediately after changing its source in the preview and after saving', async ({ page }) => {
	const { writes } = await home(page)
	const dialog = await edit(page, 'Broken icon')
	const preview = dialog.locator('.item-editor-icon-preview .item-icon')
	await expect(preview).toHaveText('BR')
	await dialog.getByRole('textbox', { name: '输入图标地址或上传', exact: true }).fill('/icon-fixture/square.svg')
	await expect(preview.locator('img')).toBeVisible()
	await expect.poll(() => preview.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
	await dialog.getByRole('textbox', { name: '图标背景色', exact: true }).fill('#125abc')
	await expect(preview).toHaveCSS('background-color', 'rgb(18, 90, 188)')
	await save(dialog)
	expect(writes[0].icon.src).toBe('/icon-fixture/square.svg')
	await expect(icon(page, 'Broken icon').locator('img')).toBeVisible()
	await expect.poll(() => icon(page, 'Broken icon').locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
})

test('new image items start with glass and their live preview matches the saved empty background', async ({ page }, info) => {
	test.setTimeout(60_000)
	for (const language of ['zh-CN', 'en-US'] as const) {
		const { writes, names } = await home(page, { language, wallpaper: true, theme: 'dark' })
		await page.getByRole('button', { name: `Icon gallery ${names.add}`, exact: true }).click()
		const dialog = page.locator('.item-editor-modal')
		const background = dialog.getByRole('textbox', { name: names.background, exact: true })
		await expect(background).toHaveValue('')
		await expect(background).toHaveAttribute('placeholder', language === 'zh-CN' ? /留空.*磨砂/ : /(?:empty|blank).*glass/i)
		await dialog.getByRole('textbox', { name: names.title, exact: true }).fill('New glass icon')
		await dialog.getByRole('textbox', { name: names.url, exact: true }).fill('https://example.test/new')
		await dialog.getByRole('combobox', { name: names.type, exact: true }).click()
		await page.locator('.ant-select-dropdown:visible').getByText(names.image, { exact: true }).click()
		await dialog.getByRole('textbox', { name: names.source, exact: true }).fill('/icon-fixture/google.svg')
		const preview = dialog.locator('.item-editor-icon-preview .item-icon')
		await expect(preview.locator('img')).toBeVisible()
		await expect(preview).toHaveCSS('backdrop-filter', /blur\(/)
		const size = await preview.boundingBox()
		expect(size!.width).toBeCloseTo(50, 0)
		expect(size!.height).toBeCloseTo(50, 0)
		await page.screenshot({ path: info.outputPath(`new-glass-preview-${language}.png`), animations: 'disabled' })
		await save(dialog, names.save)
		expect(writes[0].icon.backgroundColor).toBe('')
		await expect(icon(page, 'New glass icon').locator('img')).toBeVisible()
		await expect(icon(page, 'New glass icon')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)')
	}
})

test('icon tiles and their editor remain usable across themes, wallpaper, narrow screens and detail cards', async ({ page }, info) => {
	test.setTimeout(60_000)
	const scenarios = [
		{ theme: 'light', wallpaper: false, iconStyle: 1, width: 1440 },
		{ theme: 'dark', wallpaper: false, iconStyle: 1, width: 1440 },
		{ theme: 'light', wallpaper: true, iconStyle: 1, width: 1440 },
		{ theme: 'dark', wallpaper: true, iconStyle: 1, width: 320 },
		{ theme: 'dark', wallpaper: true, iconStyle: 2, width: 1440 },
	] as const
	for (const [index, scenario] of scenarios.entries()) {
		await page.setViewportSize({ width: scenario.width, height: 900 })
		await home(page, scenario)
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
		await expect(icon(page, '满版图标')).toBeInViewport({ ratio: 1 })
		await page.screenshot({ path: info.outputPath(`gallery-${index}-${scenario.theme}-${scenario.width}-style-${scenario.iconStyle}.png`), fullPage: true, animations: 'disabled' })
		await page.locator('.navigation-group').screenshot({ path: info.outputPath(`icon-group-${index}-${scenario.theme}-${scenario.width}-style-${scenario.iconStyle}.png`), animations: 'disabled' })
		const dialog = await edit(page, '谷歌')
		const preview = dialog.locator('.item-editor-icon-preview .item-icon')
		await preview.scrollIntoViewIfNeeded()
		await expect(preview).toBeInViewport({ ratio: 1 })
		await expect(preview.locator('img')).toBeVisible()
		await expect(dialog.getByRole('textbox', { name: '图标背景色', exact: true })).toBeVisible()
		await expect(dialog.locator('.item-editor-footer').getByRole('button', { name: '确定', exact: true })).toBeInViewport({ ratio: 1 })
		await page.screenshot({ path: info.outputPath(`editor-${index}-${scenario.theme}-${scenario.width}.png`), animations: 'disabled' })
	}
})
