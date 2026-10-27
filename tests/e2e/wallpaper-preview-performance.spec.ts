import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

declare global {
	interface Window {
		wallpaperPreviewProbe: { reads: number; statuses: (string | null)[] }
	}
}

async function fixture(page: Page, autoContrast: boolean, remote = false) {
	const panel = {
		backgroundImageSrc: remote
			? 'https://preview-performance.test/preview-performance.svg'
			: '/preview-performance.svg',
		iconTextColor: '#ffffff',
		backgroundMaskNumber: 0,
		backgroundBlur: 0,
		wallpaperAutoContrast: autoContrast,
	}
	const writes: (typeof panel)[] = []
	let imageRequests = 0
	await page.clock.install({ time: new Date('2026-10-26T10:00:00Z') })
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.addInitScript(() => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'preview-performance-fixture',
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
					accounts: [],
				},
			}),
		)
	})
	// All account reads and writes stay in this fixture.
	await page.route('**/api/**', (route) => {
		const pathname = new URL(route.request().url()).pathname
		let data: unknown = null
		if (pathname === '/api/user/getAuthInfo') data = { user: { id: 2501, role: 1 }, visitMode: 0 }
		if (pathname === '/api/openness/loginConfig') data = { siteSetting: {}, loginCaptcha: false }
		if (pathname === '/api/panel/userConfig/get') data = { panel, panelWarnings: [] }
		if (pathname === '/api/panel/userConfig/set') {
			const changed = route.request().postDataJSON().panel as typeof panel
			writes.push(structuredClone(changed))
			Object.assign(panel, changed)
		}
		return route.fulfill({ json: { code: 0, data } })
	})
	await page.route('**/preview-performance.svg', (route) => {
		imageRequests++
		return route.fulfill({
			contentType: 'image/svg+xml',
			...(remote ? { headers: { 'access-control-allow-origin': 'https://different.test' } } : {}),
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><path fill="#fff" d="M0 0h1440v900H0z"/><path fill="#000" d="M0 0h720v900H0z"/></svg>',
		})
	})
	await page.goto('/#/settings/appearance')
	await expect(page.locator('.wallpaper-preview')).toHaveAttribute(
		'data-wallpaper-status',
		remote ? 'unreadable' : 'ready',
	)
	await page.evaluate(() => document.fonts.ready)
	await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50))
	await page.evaluate(() => {
		window.wallpaperPreviewProbe = { reads: 0, statuses: [] }
		const readPixels = CanvasRenderingContext2D.prototype.getImageData
		CanvasRenderingContext2D.prototype.getImageData = function (sx, sy, sw, sh, settings) {
			window.wallpaperPreviewProbe.reads++
			return readPixels.call(this, sx, sy, sw, sh, settings)
		}
		const preview = document.querySelector('.wallpaper-preview')!
		new MutationObserver(() => {
			window.wallpaperPreviewProbe.statuses.push(preview.getAttribute('data-wallpaper-status'))
		}).observe(preview, { attributes: true, attributeFilter: ['data-wallpaper-status'] })
	})
	return { writes, imageRequests: () => imageRequests }
}

for (const autoContrast of [false, true]) {
	test(`wallpaper pointer drags keep geometry and status stable with automatic contrast ${autoContrast}`, async ({
		page,
	}, info) => {
		const state = await fixture(page, autoContrast)
		for (const [index, label] of ['壁纸模糊', '壁纸暗度'].entries()) {
			const handle = page.getByRole('slider', { name: label, exact: true })
			await handle.scrollIntoViewIfNeeded()
			const slider = handle.locator('xpath=..')
			const rail = await slider.locator('.ant-slider-rail').boundingBox()
			const start = await handle.boundingBox()
			expect(rail).not.toBeNull()
			expect(start).not.toBeNull()
			const imagesBefore = state.imageRequests()
			await page.evaluate(() => {
				window.wallpaperPreviewProbe.reads = 0
				window.wallpaperPreviewProbe.statuses = []
			})
			await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2)
			await page.mouse.down()
			try {
				for (let level = 1; level <= 8; level++) {
					await page.mouse.move(rail!.x + (rail!.width * level) / 10, start!.y + start!.height / 2)
					// Keep each move below the analysis debounce while allowing real animation frames.
					await page.clock.runFor(20)
					await expect(handle).toHaveAttribute('aria-valuenow', String(level))
					expect((await handle.boundingBox())!.y).toBeCloseTo(start!.y, 1)
					await expect(page.locator('.wallpaper-preview')).toHaveAttribute('data-wallpaper-status', 'ready')
					await expect(page.locator('.wallpaper-preview-status > span').last()).not.toContainText('加载')
				}
				expect(await page.evaluate(() => window.wallpaperPreviewProbe.reads)).toBe(0)
				// Pausing with the pointer held may update colors, but must not save mid-gesture.
				await page.clock.runFor(1000)
				expect(await page.evaluate(() => window.wallpaperPreviewProbe.reads)).toBe(1)
				expect(state.writes).toHaveLength(index)
				expect((await handle.boundingBox())!.y).toBeCloseTo(start!.y, 1)
				expect(await page.evaluate(() => window.wallpaperPreviewProbe.statuses)).not.toContain('loading')
				expect(state.imageRequests()).toBe(imagesBefore)
			} finally {
				await page.mouse.up()
			}
			await page.clock.runFor(650)
			await expect.poll(() => state.writes.length).toBe(index + 1)
			await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
			expect(state.writes[index].backgroundBlur).toBe(24)
			if (index === 1) expect(state.writes[index].backgroundMaskNumber).toBe(0.8)
		}
		await page.screenshot({ path: info.outputPath('stable-wallpaper-sliders.png'), animations: 'disabled' })
	})
}

test('a narrow CORS preview reserves stable geometry while text presets and automatic contrast change', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 900 })
	await fixture(page, false, true)
	const preview = page.locator('.wallpaper-preview')
	const controls = page.locator(
		'.wallpaper-preview-status, #backgroundImageSrc, .form-grid.spaced .ant-slider, #wallpaperAutoContrast',
	)
	const measure = () =>
		controls.evaluateAll((elements) => {
			const scroll = document.querySelector('.settings-form-content')!
			const bounds = scroll.getBoundingClientRect()
			return elements.map((element) => {
				const rect = element.getBoundingClientRect()
				return {
					label: element.id || element.className,
					x: rect.x,
					y: rect.y - bounds.y + scroll.scrollTop,
					width: rect.width,
					height: rect.height,
				}
			})
		})
	const original = await measure()
	expect(original).toHaveLength(5)
	const expectGeometry = async () => {
		const current = await measure()
		expect(current.map((value) => value.label)).toEqual(original.map((value) => value.label))
		for (let index = 0; index < original.length; index++) {
			for (const axis of ['x', 'y', 'width', 'height'] as const)
				expect(current[index][axis], `${current[index].label} ${axis}`).toBeCloseTo(original[index][axis], 1)
		}
	}
	const settle = async () => {
		await expect(preview).toHaveAttribute('data-wallpaper-status', 'loading')
		await expectGeometry()
		await page.clock.runFor(200)
		await expect(preview).toHaveAttribute('data-wallpaper-status', 'unreadable')
		await expectGeometry()
		await page.clock.runFor(650)
		await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
		await expectGeometry()
	}
	for (const label of ['黑色', '白色'] as const) {
		await page.getByRole('combobox', { name: '首页文字颜色', exact: true }).click()
		await page
			.locator('.ant-select-dropdown:visible .ant-select-item-option')
			.filter({ hasText: label })
			.click()
		await settle()
	}
	const automatic = page.getByRole('switch', { name: '自动调整壁纸对比度', exact: true })
	await automatic.check()
	await settle()
	await automatic.uncheck()
	await settle()
})
