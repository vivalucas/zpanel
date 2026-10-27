import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const svg = (fill: string) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><path fill="${fill}" d="M0 0h1440v900H0z"/></svg>`
const white = 'rgb(255, 255, 255)'
const black = 'rgb(32, 39, 51)'
const mainText =
	'.home-logo-text, .clock time, .clock span, .group-heading h2, .app-copy strong, .app-copy > span, .home-footer-content, .home-footer-content a'
const mainTextWithoutClock =
	'.home-logo-text, .group-heading h2, .app-copy strong, .app-copy > span, .home-footer-content, .home-footer-content a'

async function fixture(
	page: Page,
	initial: Record<string, unknown> = {},
	theme: 'auto' | 'light' | 'dark' = 'auto',
) {
	const panel: Record<string, unknown> = {
		logoText: '固定文字测试',
		backgroundImageSrc: '/home-text/light.svg',
		backgroundMaskNumber: 0,
		backgroundBlur: 0,
		wallpaperAutoContrast: false,
		iconStyle: 2,
		marginTop: 2,
		marginBottom: 2,
		footerHtml: '<span>页脚文字 <a href="https://example.test/footer">页脚链接</a></span>',
		...initial,
	}
	const writes: Record<string, unknown>[] = []
	await page.emulateMedia({ colorScheme: theme === 'auto' ? 'light' : theme, reducedMotion: 'reduce' })
	await page.addInitScript((theme) => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'home-text-fixture',
					theme,
					language: 'zh-CN',
					network: 'wan',
					accounts: [],
					homeEditHintDismissed: true,
				},
			}),
		)
	}, theme)
	await page.route('**/api/**', async (route) => {
		const path = new URL(route.request().url()).pathname
		let data: unknown = null
		if (path === '/api/user/getAuthInfo')
			data = { user: { id: 8301, name: 'Text test', role: 1 }, visitMode: 0 }
		if (path === '/api/openness/loginConfig') data = { siteSetting: {}, loginCaptcha: false }
		if (path === '/api/panel/userConfig/get') data = { panel, panelWarnings: [] }
		if (path === '/api/panel/userConfig/set') {
			const changed = route.request().postDataJSON() as { panel: Record<string, unknown> }
			writes.push(structuredClone(changed.panel))
			Object.assign(panel, changed.panel)
		}
		if (path === '/api/panel/itemIconGroup/getNavigation')
			data = [
				{
					id: 8300,
					title: '导航分组',
					items: ['#ffffff', '#123045', undefined].map((backgroundColor, index) => ({
						id: 8302 + index,
						title: `应用 ${index + 1}`,
						description: `应用描述 ${index + 1}`,
						url: 'https://example.test',
						openMethod: 2,
						itemIconGroupId: 8300,
						icon: { itemType: 1, text: index === 2 ? 'N' : index ? 'D' : 'L', backgroundColor },
					})),
				},
			]
		if (path === '/api/system/moduleConfig/getByName') {
			const engine = { title: 'Search', url: 'https://example.test/?q=%s' }
			data = { searchEngineList: [engine], currentSearchEngine: engine, newWindowOpen: true }
		}
		return route.fulfill({ json: { code: 0, data } })
	})
	await page.route('**/home-text/*.svg', (route) => {
		const name = new URL(route.request().url()).pathname.split('/').at(-1)
		return name === 'missing.svg'
			? route.fulfill({ status: 404, body: '' })
			: route.fulfill({
					contentType: 'image/svg+xml',
					body: svg(
						name === 'black.svg'
							? '#000000'
							: name === 'white.svg'
								? '#ffffff'
								: name === 'dark.svg'
									? '#14202d'
									: '#f5f0e5',
					),
				})
	})
	await page.route('https://home-text.test/remote.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: svg('#f5f0e5'),
			headers: { 'access-control-allow-origin': 'https://different.test' },
		}),
	)
	return { panel, writes }
}

async function expectColor(target: Locator, color: string) {
	await expect(target.first()).toBeAttached()
	if (await target.page().locator('.home-page').count()) {
		await expect(target.page().locator('.home-navigation-state')).toHaveCount(0)
		await expect(target.page().locator('.home-footer-content')).toBeVisible()
	}
	await expect
		.poll(async () =>
			target.evaluateAll(
				(elements, expected) =>
					elements.length > 0 && elements.every((element) => getComputedStyle(element).color === expected),
				color,
			),
		)
		.toBe(true)
	expect(await target.count()).toBeGreaterThan(0)
}

async function expectPreview(page: Page, color: string, tone: 'light' | 'dark') {
	await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-home-text-tone', tone)
	await expectColor(page.locator('.wallpaper-preview-title, .wallpaper-preview-name'), color)
}

async function wallpaperTextContrast(page: Page, background: number[]) {
	const colors = await page.locator('.home-page').evaluate((root) => {
		const canvas = document.createElement('canvas')
		canvas.width = canvas.height = 1
		const context = canvas.getContext('2d')!
		const rgba = (color: string) => {
			context.clearRect(0, 0, 1, 1)
			context.fillStyle = color
			context.fillRect(0, 0, 1, 1)
			const value = [...context.getImageData(0, 0, 1, 1).data]
			value[3] /= 255
			return value
		}
		return {
			ink: rgba(getComputedStyle(root.querySelector('.group-heading h2')!).color),
			layers: [...root.querySelectorAll('.home-mask, .home-contrast-mask')].map((layer) =>
				rgba(getComputedStyle(layer).backgroundColor),
			),
		}
	})
	const mix = (front: number[], back: number[]) => {
		const alpha = front[3] ?? 1
		return front.slice(0, 3).map((value, index) => value * alpha + back[index] * (1 - alpha))
	}
	const luminance = (rgb: number[]) =>
		rgb.reduce((sum, value, index) => {
			const channel = value / 255
			return (
				sum +
				[0.2126, 0.7152, 0.0722][index] *
					(channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
			)
		}, 0)
	const surface = colors.layers.reduce((back, color) => mix(color, back), background)
	const front = luminance(mix(colors.ink, surface))
	const back = luminance(surface)
	return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
}

async function choosePreset(page: Page, label: '白色' | '黑色') {
	await page.getByRole('combobox', { name: '首页文字颜色', exact: true }).click()
	await page
		.locator('.ant-select-dropdown:visible .ant-select-item-option')
		.filter({ hasText: label })
		.click()
}

for (const value of [undefined, '', '#1f2937']) {
	test(`default text ${value === undefined ? 'without a stored color' : `with legacy ${JSON.stringify(value)}`} is white with a fine outline and stronger weight`, async ({
		page,
	}) => {
		const { writes } = await fixture(page, value === undefined ? {} : { iconTextColor: value })
		await page.goto('/#/')
		await expect(page.locator('.home-page')).toHaveAttribute('data-home-text-tone', 'dark')
		await expectColor(page.locator(mainText), white)
		const styles = await page.locator('.home-page').evaluate((root) =>
			[
				['.home-logo-text', 700],
				['.clock time', 600],
				['.clock span', 400],
				['.group-heading h2', 700],
				['.app-copy strong', 600],
				['.app-copy > span', 400],
				['.home-footer-content', 400],
			].map(([selector, oldWeight]) => {
				const style = getComputedStyle(root.querySelector(selector as string)!)
				return {
					selector,
					oldWeight,
					weight: Number(style.fontWeight),
					strokeWidth: Number.parseFloat(style.webkitTextStrokeWidth),
					strokeColor: style.webkitTextStrokeColor,
					shadow: style.textShadow,
				}
			}),
		)
		for (const style of styles) {
			expect(style.weight, String(style.selector)).toBeGreaterThan(Number(style.oldWeight))
			expect(style.strokeWidth, String(style.selector)).toBeGreaterThan(0)
			expect(style.strokeWidth, String(style.selector)).toBeLessThanOrEqual(1)
			expect(style.strokeColor, String(style.selector)).toMatch(/rgba?\(0, 0, 0(?:,|\))/)
			expect(style.shadow, String(style.selector)).not.toBe('none')
		}
		await page.getByRole('button', { name: '设置', exact: true }).click()
		await expect(
			page
				.locator('.ant-select')
				.filter({ has: page.getByRole('combobox', { name: '首页文字颜色', exact: true }) }),
		).toContainText('白色')
		await expectPreview(page, white, 'dark')
		expect(writes).toHaveLength(0)
	})
}

for (const preset of [
	{ label: '白色', value: '#ffffff', rgb: white, tone: 'dark' },
	{ label: '黑色', value: '#202733', rgb: black, tone: 'light' },
] as const) {
	test(`the ${preset.label} text choice saves automatically and matches the home preview`, async ({
		page,
	}, info) => {
		const { writes } = await fixture(page, {
			iconTextColor: preset.value === '#ffffff' ? '#202733' : '#ffffff',
		})
		await page.goto('/#/settings/appearance')
		await choosePreset(page, preset.label)
		await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
		expect(writes).toHaveLength(1)
		expect(writes[0].iconTextColor).toBe(preset.value)
		await expectPreview(page, preset.rgb, preset.tone)
		await page.getByRole('button', { name: '返回首页', exact: true }).click()
		await expectColor(page.locator(mainText), preset.rgb)
		await expect(page.locator('.home-page')).toHaveAttribute('data-home-text-tone', preset.tone)
		await page.reload()
		await expectColor(page.locator(mainText), preset.rgb)
		for (const width of [1440, 320]) {
			await page.setViewportSize({ width, height: 900 })
			await page.screenshot({
				path: info.outputPath(`${preset.tone}-${width}-manual-text.png`),
				animations: 'disabled',
			})
		}
	})

	test(`fixed ${preset.label} text survives theme, viewport, wallpaper, CORS, and image failures`, async ({
		page,
	}) => {
		const { panel, writes } = await fixture(page, { iconTextColor: preset.value })
		for (const scenario of [
			{ source: '/home-text/light.svg', status: 'ready' },
			{ source: '/home-text/dark.svg', status: 'ready' },
			{ source: 'https://home-text.test/remote.svg', status: 'unreadable' },
			{ source: '/home-text/missing.svg', status: 'error' },
			{ source: '', status: 'none' },
		]) {
			panel.backgroundImageSrc = scenario.source
			await page.goto(`/?homeText=${encodeURIComponent(scenario.source)}#/`)
			await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', scenario.status)
			for (const theme of ['light', 'dark'] as const) {
				await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
				for (const width of [1440, 320]) {
					await page.setViewportSize({ width, height: 900 })
					await expect(page.locator('.home-page')).toHaveAttribute('data-home-text-tone', preset.tone)
					await expectColor(page.locator(mainText), preset.rgb)
					if (scenario.status === 'none' || scenario.status === 'error')
						await expect(page.locator('.home-mask, .home-contrast-mask')).toHaveCount(0)
					else await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
				}
			}
			await page.getByRole('button', { name: '设置', exact: true }).click()
			for (const theme of ['light', 'dark'] as const) {
				await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
				for (const width of [1440, 320]) {
					await page.setViewportSize({ width, height: 900 })
					await expectPreview(page, preset.rgb, preset.tone)
				}
			}
		}
		expect(writes).toHaveLength(0)
	})
}

test('an existing custom text color is preserved and remains editable with automatic saving', async ({
	page,
}) => {
	const { writes } = await fixture(page, { iconTextColor: '#b04171' })
	await page.goto('/#/settings/appearance')
	const choice = page.getByRole('combobox', { name: '首页文字颜色', exact: true })
	await expect(page.locator('.ant-select').filter({ has: choice })).toContainText('自定义颜色')
	const custom = page.getByLabel('自定义文字颜色', { exact: true })
	if (!(await custom.isVisible()))
		await page.locator('details').filter({ has: custom }).locator('summary').click()
	await expect(custom).toHaveValue('#b04171')
	await page.locator('#logoText').fill('Custom color')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)?.iconTextColor).toBe('#b04171')
	await expectPreview(page, 'rgb(176, 65, 113)', 'light')
	await custom.fill('')
	await expect(custom).toBeVisible()
	await expect(custom).toBeFocused()
	await custom.pressSequentially('#ffffff', { delay: 20 })
	await expect(custom).toHaveValue('#ffffff')
	await expect(custom).toBeVisible()
	await expect(custom).toBeFocused()
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)?.iconTextColor).toBe('#ffffff')
	await custom.fill('rgb(61, 85, 102)')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)?.iconTextColor).toBe('rgb(61, 85, 102)')
	await page.getByRole('button', { name: '返回首页', exact: true }).click()
	await expectColor(page.locator(mainText), 'rgb(61, 85, 102)')
})

for (const color of [
	'inherit',
	'initial',
	'unset',
	'revert',
	'revert-layer',
	'currentColor',
	'var(--home-test-ink, #13b8ae)',
	'light-dark(#202733, #ffffff)',
]) {
	test(`contextual custom ink ${color} keeps the original wallpaper and stored CSS value`, async ({
		page,
	}, info) => {
		const { panel, writes } = await fixture(page, {
			iconTextColor: color,
			backgroundImageSrc: '/home-text/black.svg',
			wallpaperAutoContrast: false,
		})
		await page.goto('/#/')
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		const originalColors = await page
			.locator(mainText)
			.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color))
		const originalContrast = await wallpaperTextContrast(page, [0, 0, 0])
		panel.wallpaperAutoContrast = true
		await page.reload()
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		expect(
			await page
				.locator(mainText)
				.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color)),
		).toEqual(originalColors)
		await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
		expect(await wallpaperTextContrast(page, [0, 0, 0])).toBeCloseTo(originalContrast, 10)
		if (color === 'inherit') {
			await expectColor(page.locator(mainText), white)
			expect(originalContrast).toBe(21)
			await page.screenshot({
				path: info.outputPath('inherit-original-contrast.png'),
				animations: 'disabled',
			})
		}
		expect(writes).toHaveLength(0)
		await page.getByRole('button', { name: '设置', exact: true }).click()
		await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expect(page.locator('.wallpaper-preview-contrast')).toHaveCSS('background-color', /, 0\)$/)
		await expect(page.getByLabel('自定义文字颜色', { exact: true })).toHaveValue(color)
		await page.locator('#logoText').fill('Preserve contextual CSS')
		await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
		expect(writes.at(-1)?.iconTextColor).toBe(color)
	})
}

test('valid fixed custom inks still receive a veil based on their actual RGBA', async ({ page }) => {
	const { panel, writes } = await fixture(page, {
		backgroundImageSrc: '/home-text/black.svg',
		wallpaperAutoContrast: true,
	})
	for (const { value, computed } of [
		{ value: 'blue', computed: 'rgb(0, 0, 255)' },
		{ value: 'hsl(240 100% 50%)', computed: 'rgb(0, 0, 255)' },
		{ value: 'color-mix(in srgb, blue 100%, white)', computed: 'color(srgb 0 0 1)' },
		{ value: 'rgba(0, 0, 255, 0.86)', computed: 'rgba(0, 0, 255, 0.86)' },
	]) {
		panel.iconTextColor = value
		await page.goto(`/?fixedInk=${encodeURIComponent(value)}#/`)
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
		await expectColor(page.locator(mainText), computed)
		expect(await wallpaperTextContrast(page, [0, 0, 0])).toBeGreaterThanOrEqual(4.5)
		expect(
			await page
				.locator('.home-page')
				.evaluate((root) => Number(getComputedStyle(root).getPropertyValue('--wallpaper-scrim'))),
		).toBeGreaterThan(0)
	}
	expect(writes).toHaveLength(0)
})

for (const scheme of ['light', 'dark'] as const) {
	test(`system and escaped contextual inks keep their original contrast in the ${scheme} color scheme`, async ({
		page,
	}) => {
		const { panel, writes } = await fixture(page, { backgroundImageSrc: '/home-text/black.svg' }, scheme)
		for (const color of [
			'CanvasText',
			'color-mix(in srgb, \\43 anvasText 100%, white)',
			'color-mix(in srgb, rgb(from current\\43 olor r g b) 100%, white 0%)',
			'v\\61 r(--home-test-ink, #13b8ae)',
		]) {
			panel.iconTextColor = color
			panel.wallpaperAutoContrast = false
			await page.goto(`/?contextualInk=${encodeURIComponent(color)}#/`)
			await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
			await expect(page.locator('html')).toHaveCSS('color-scheme', scheme)
			const originalColors = await page
				.locator(mainText)
				.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color))
			const originalContrast = await wallpaperTextContrast(page, [0, 0, 0])
			panel.wallpaperAutoContrast = true
			await page.reload()
			await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
			expect(await wallpaperTextContrast(page, [0, 0, 0])).toBeCloseTo(originalContrast, 10)
			expect(
				await page
					.locator(mainText)
					.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color)),
			).toEqual(originalColors)
			if (color === 'CanvasText')
				await expectColor(page.locator(mainText), scheme === 'dark' ? white : 'rgb(0, 0, 0)')
			await page.getByRole('button', { name: '设置', exact: true }).click()
			await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
			await expect(page.locator('.wallpaper-preview-contrast')).toHaveCSS('background-color', /, 0\)$/)
			await expect(page.getByLabel('自定义文字颜色', { exact: true })).toHaveValue(color)
			await page.locator('#logoText').fill(`Keep ${color}`)
			await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
			expect(writes.at(-1)?.iconTextColor).toBe(color)
		}
	})
}

test('manual home text colors preserve icon-internal contrast and an explicit clock color', async ({
	page,
}) => {
	const { writes } = await fixture(page, { iconTextColor: '#ffffff', clockColor: '#316e91' })
	await page.goto('/#/')
	await expectColor(page.locator(mainTextWithoutClock), white)
	await expectColor(page.locator('.clock time, .clock span'), 'rgb(49, 110, 145)')
	const iconColors = await page
		.locator('.item-icon-symbol')
		.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color))
	expect(iconColors.slice(0, 2)).toEqual(['rgb(0, 0, 0)', 'rgb(255, 255, 255)'])
	const iconStyles = await page.locator('.item-icon-symbol').evaluateAll((elements) =>
		elements.map((element) => {
			const style = getComputedStyle(element)
			return { shadow: style.textShadow, strokeWidth: style.webkitTextStrokeWidth }
		}),
	)
	await page.getByRole('button', { name: '设置', exact: true }).click()
	await choosePreset(page, '黑色')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)?.clockColor).toBe('#316e91')
	await page.getByRole('button', { name: '返回首页', exact: true }).click()
	await expectColor(page.locator(mainTextWithoutClock), black)
	await expectColor(page.locator('.clock time, .clock span'), 'rgb(49, 110, 145)')
	expect(
		await page
			.locator('.item-icon-symbol')
			.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color)),
	).toEqual(iconColors)
	expect(
		await page.locator('.item-icon-symbol').evaluateAll((elements) =>
			elements.map((element) => {
				const style = getComputedStyle(element)
				return { shadow: style.textShadow, strokeWidth: style.webkitTextStrokeWidth }
			}),
		),
	).toEqual(iconStyles)
})

for (const scenario of [
	{ source: '/home-text/white.svg', status: 'ready' },
	{ source: 'https://home-text.test/remote.svg', status: 'unreadable' },
] as const) {
	test(`automatic contrast preserves the actual custom gray ink on ${scenario.status === 'ready' ? 'white wallpaper' : 'unreadable CORS wallpaper'}`, async ({
		page,
	}) => {
		const { writes } = await fixture(page, {
			iconTextColor: '#777777',
			backgroundImageSrc: scenario.source,
			wallpaperAutoContrast: true,
		})
		await page.goto('/#/')
		await expect(page.locator('.home-page')).toHaveAttribute('data-wallpaper-status', scenario.status)
		await expectColor(page.locator(mainText), 'rgb(119, 119, 119)')
		if (scenario.status === 'ready') {
			const contrast = await page.locator('.home-page').evaluate((root) => {
				const rgba = (color: string) => color.match(/[\d.]+/g)!.map(Number)
				const luminance = (rgb: number[]) =>
					rgb.slice(0, 3).reduce((sum, value, index) => {
						const channel = value / 255
						return (
							sum +
							[0.2126, 0.7152, 0.0722][index] *
								(channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
						)
					}, 0)
				const ratio = (front: number[], back: number[]) => {
					const a = luminance(front)
					const b = luminance(back)
					return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
				}
				const ink = rgba(getComputedStyle(root.querySelector('.group-heading h2')!).color)
				let background = [255, 255, 255]
				for (const layer of root.querySelectorAll('.home-mask, .home-contrast-mask')) {
					const color = rgba(getComputedStyle(layer).backgroundColor)
					const alpha = color[3] ?? 1
					background = color
						.slice(0, 3)
						.map((channel, index) => channel * alpha + background[index] * (1 - alpha))
				}
				return { original: ratio(ink, [255, 255, 255]), actual: ratio(ink, background) }
			})
			expect(contrast.original).toBeGreaterThan(4.4)
			expect(contrast.actual).toBeGreaterThanOrEqual(contrast.original)
		} else {
			await expect(page.locator('.home-page')).toHaveCSS('--wallpaper-scrim', '0')
			await expect(page.locator('.home-mask')).toHaveCSS('background-color', 'rgba(10, 15, 30, 0)')
		}
		const homeMask = await page
			.locator('.home-contrast-mask')
			.evaluate((element) => getComputedStyle(element).backgroundColor)
		await page.getByRole('button', { name: '设置', exact: true }).click()
		await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', scenario.status)
		await expectPreview(page, 'rgb(119, 119, 119)', 'dark')
		await expect(page.locator('.wallpaper-preview-contrast')).toHaveCSS('background-color', homeMask)
		expect(writes).toHaveLength(0)
	})
}

for (const theme of ['light', 'dark'] as const) {
	for (const preset of [
		{ value: '#ffffff', color: white },
		{ value: '#202733', color: black },
	]) {
		test(`the home tool buttons retain neutral hover and visible keyboard focus in ${theme} with ${preset.value} text`, async ({
			page,
		}) => {
			await fixture(page, { iconTextColor: preset.value })
			await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
			await page.goto('/#/')
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
			const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
			await expect(tools).toBeVisible()
			const buttons = tools.getByRole('button')
			await expect(buttons).toHaveCount(2)
			for (const button of await buttons.all()) {
				await expect(button).toHaveCSS('color', preset.color)
				await button.hover()
				await expect(button).toHaveCSS('color', preset.color)
				await expect(button).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
				await page.mouse.move(0, 0)
				await button.focus()
				await page.keyboard.press('Tab')
				await page.keyboard.press('Shift+Tab')
				await expect(button).toBeFocused()
				await expect(button).toHaveCSS('color', preset.color)
				const focus = await button.evaluate((element) => {
					const style = getComputedStyle(element)
					return {
						visible: element.matches(':focus-visible'),
						width: Number.parseFloat(style.outlineWidth),
						style: style.outlineStyle,
						color: style.outlineColor,
					}
				})
				expect(focus.visible).toBe(true)
				expect(focus.width).toBeGreaterThanOrEqual(2)
				expect(focus.style).not.toBe('none')
				expect(focus.color).toBe(preset.color)
			}
		})
	}

	test(`icons without a custom background keep their ${theme} UI foreground through both manual text presets`, async ({
		page,
	}) => {
		await fixture(page, { iconTextColor: '#ffffff' })
		await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
		await page.goto('/#/')
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
		const plainIcon = page.locator('.item-icon:not(.item-icon-custom) .item-icon-symbol')
		await expect(plainIcon).toHaveCount(1)
		const uiColor = await page.locator('.app-root').evaluate((element) => getComputedStyle(element).color)
		await expect(plainIcon).toHaveCSS('color', uiColor)
		const before = await page.locator('.item-icon-symbol').evaluateAll((elements) =>
			elements.map((element) => {
				const style = getComputedStyle(element)
				return { color: style.color, stroke: style.webkitTextStrokeWidth, shadow: style.textShadow }
			}),
		)
		for (const label of ['黑色', '白色'] as const) {
			await page.getByRole('button', { name: '设置', exact: true }).click()
			await choosePreset(page, label)
			await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
			await page.getByRole('button', { name: '返回首页', exact: true }).click()
			await expect(plainIcon).toHaveCSS('color', uiColor)
			expect(
				await page.locator('.item-icon-symbol').evaluateAll((elements) =>
					elements.map((element) => {
						const style = getComputedStyle(element)
						return { color: style.color, stroke: style.webkitTextStrokeWidth, shadow: style.textShadow }
					}),
				),
			).toEqual(before)
		}
	})
}
