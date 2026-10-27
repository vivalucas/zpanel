import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const items = [
	{ id: 6101, title: 'Loading app', url: '/favicon.svg', openMethod: 2, icon: { itemType: 1, text: 'Z' } },
	{ id: 6102, title: 'Second app', url: '/favicon.svg', openMethod: 2, icon: { itemType: 1, text: 'S' } },
]
function gate() {
	let release!: () => void
	const waiting = new Promise<void>((resolve) => {
		release = resolve
	})
	return { waiting, release: () => release() }
}
async function preferences(page: Page) {
	await page.addInitScript(() =>
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'loading-fixture',
					accounts: [],
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
					homeEditHintDismissed: true,
				},
			}),
		),
	)
}
async function api(
	page: Page,
	options: {
		authGate?: ReturnType<typeof gate>
		navigationGate?: ReturnType<typeof gate>
		wallpaper?: boolean
	} = {},
) {
	const reads: string[] = []
	await preferences(page)
	await page.route('**/api/**', async (route) => {
		const pathname = new URL(route.request().url()).pathname
		let data: unknown = null
		if (pathname === '/api/user/getAuthInfo') {
			await options.authGate?.waiting
			data = { user: { id: 6100, role: 2 }, visitMode: 0 }
		} else if (pathname === '/api/openness/loginConfig') {
			data = { loginCaptcha: false, siteSetting: {} }
		} else {
			reads.push(pathname)
			if (pathname === '/api/panel/userConfig/get')
				data = {
					panel: {
						logoText: 'Loading home',
						footerHtml: '',
						...(options.wallpaper ? { backgroundImageSrc: '/loading-wallpaper.svg' } : {}),
					},
					panelWarnings: [],
				}
			if (pathname === '/api/panel/itemIconGroup/getNavigation') {
				await options.navigationGate?.waiting
				data = [{ id: 6100, title: 'Loading group', items }]
			}
		}
		await route.fulfill({ json: { code: 0, data } })
	})
	return reads
}

test('home code loads with authentication, then the header and wallpaper render before navigation', async ({
	page,
}, info) => {
	const authGate = gate()
	const navigationGate = gate()
	const reads = await api(page, { authGate, navigationGate, wallpaper: true })
	let homeCode = false
	let wallpaper = false
	page.on('request', (request) => {
		if (/\/assets\/Home-[^/]+\.js$/.test(new URL(request.url()).pathname)) homeCode = true
	})
	await page.route('**/loading-wallpaper.svg', (route) => {
		wallpaper = true
		return route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><path fill="#436181" d="M0 0h1440v1000H0z"/></svg>',
		})
	})
	try {
		await page.goto('/#/')
		await expect.poll(() => homeCode).toBe(true)
		expect(reads).toEqual([])
		await expect(page.locator('.home-page')).toHaveCount(0)
		authGate.release()
		await expect(page.locator('.home-logo-text')).toHaveText('Loading home')
		await expect(page.getByRole('button', { name: '设置', exact: true })).toBeVisible()
		await expect(page.locator('.home-navigation-state .loading-state')).toBeVisible()
		await expect.poll(() => wallpaper).toBe(true)
		await expect(page.locator('.empty-collection')).toHaveCount(0)
		await page.screenshot({ path: info.outputPath('progressive-home.png'), animations: 'disabled' })
		navigationGate.release()
		await expect(page.getByRole('link', { name: 'Loading app', exact: true })).toBeVisible()
		await expect(page.locator('.home-navigation-state')).toHaveCount(0)
	} finally {
		authGate.release()
		navigationGate.release()
	}
})

test('editor, upload and sorting code waits for the relevant interaction', async ({ page }) => {
	await api(page)
	const scripts: string[] = []
	page.on('request', (request) => {
		const pathname = new URL(request.url()).pathname
		if (pathname.endsWith('.js')) scripts.push(pathname)
	})
	await page.goto('/#/')
	await expect(page.getByRole('link', { name: 'Loading app', exact: true })).toBeVisible()
	expect(
		scripts.filter((name) => /\/(?:ItemEditor|ItemActionMenu|Sortable|ImageUpload|upload|form)-/.test(name)),
	).toEqual([])
	await page.getByRole('button', { name: 'Loading group 添加项目', exact: true }).click()
	await expect(page.getByLabel('标题', { exact: true })).toBeVisible()
	expect(scripts.some((name) => /\/upload-/.test(name))).toBe(true)
	await page.getByRole('button', { name: '取消', exact: true }).click()
	await page.getByRole('button', { name: 'Loading group 排序', exact: true }).click()
	await expect(page.locator('.drag-handle')).toHaveCount(2)
	expect(scripts.some((name) => /\/Sortable-/.test(name))).toBe(true)
	const handle = page.locator('.drag-handle').first()
	await handle.focus()
	await page.keyboard.press('Space')
	await page.keyboard.press('ArrowRight')
	await page.keyboard.press('Escape')
	await page.getByRole('button', { name: 'Loading group 完成', exact: true }).click()
	await expect(page.locator('.drag-handle')).toHaveCount(0)
})

test('a dismissed menu or editor cannot reopen after its delayed chunk arrives', async ({ page }) => {
	await api(page)
	const menuGate = gate()
	const editorGate = gate()
	let menuRequested = false
	let editorRequested = false
	await page.route('**/assets/ItemActionMenu-*.js', async (route) => {
		menuRequested = true
		await menuGate.waiting
		await route.continue()
	})
	await page.route('**/assets/ItemEditor-*.js', async (route) => {
		editorRequested = true
		await editorGate.waiting
		await route.continue()
	})
	try {
		await page.goto('/#/')
		const link = page.getByRole('link', { name: 'Loading app', exact: true })
		await expect(link).toBeVisible()
		await link.focus()
		await page.keyboard.press('Shift+F10')
		await expect.poll(() => menuRequested).toBe(true)
		await page.keyboard.press('Enter')
		expect(page.context().pages()).toHaveLength(1)
		await page.keyboard.press('Escape')
		menuGate.release()
		await page.waitForLoadState('networkidle')
		await expect(page.locator('.item-action-popup')).toHaveCount(0)
		await expect(link).toBeFocused()
		await page.keyboard.press('Shift+F10')
		await expect(page.locator('.item-action-popup')).toBeVisible()
		await page.keyboard.press('Escape')
		await page.getByRole('button', { name: 'Loading group 添加项目', exact: true }).click()
		await expect.poll(() => editorRequested).toBe(true)
		await expect(page.getByRole('dialog')).toBeVisible()
		await page.keyboard.press('Escape')
		editorGate.release()
		await page.waitForLoadState('networkidle')
		await expect(page.getByRole('dialog')).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Loading group 添加项目', exact: true })).toBeFocused()
		await page.getByRole('button', { name: 'Loading group 添加项目', exact: true }).click()
		await expect(page.getByLabel('标题', { exact: true })).toBeVisible()
		await page.getByRole('button', { name: '取消', exact: true }).click()
	} finally {
		menuGate.release()
		editorGate.release()
	}
})

test('gallery thumbnails defer originals, recover from thumbnail failure and keep wallpaper URLs original', async ({
	page,
}) => {
	await api(page)
	const image = Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
		'base64',
	)
	const list = ['ready', 'broken'].map((name, index) => ({
		id: 6200 + index,
		ownerId: 6100,
		originalName: `${name}.png`,
		size: 4000000,
		src: `/uploads/loading-${name}.png`,
		thumbnailSrc: `/uploads/loading-${name}.png?thumbnail=1`,
	}))
	const requests: string[] = []
	let savedWallpaper = ''
	await page.route('**/api/file/getList', (route) =>
		route.fulfill({ json: { code: 0, data: { list, count: list.length } } }),
	)
	await page.route('**/api/panel/userConfig/set', (route) => {
		savedWallpaper = route.request().postDataJSON().panel.backgroundImageSrc
		return route.fulfill({ json: { code: 0 } })
	})
	await page.route('**/uploads/loading-*.png*', (route) => {
		const url = new URL(route.request().url())
		requests.push(url.pathname + url.search)
		if (url.pathname.includes('broken') && url.search) return route.fulfill({ status: 500 })
		return route.fulfill({ contentType: 'image/png', body: image })
	})
	await page.goto('/#/settings/files')
	const ready = page.locator('.file-card').filter({ hasText: 'ready.png' })
	const broken = page.locator('.file-card').filter({ hasText: 'broken.png' })
	await expect(ready.locator('img')).toHaveAttribute('src', list[0].thumbnailSrc)
	await expect(ready.locator('img')).toHaveAttribute('loading', 'lazy')
	await expect(ready.locator('img')).toHaveAttribute('decoding', 'async')
	await expect.poll(() => requests.includes(list[0].thumbnailSrc)).toBe(true)
	await expect(broken.locator('img')).toHaveAttribute('src', list[1].src)
	await expect.poll(() => requests.includes(list[1].src)).toBe(true)
	expect(requests).not.toContain(list[0].src)
	await ready.locator('.ant-image').click()
	await expect(page.locator('.ant-image-preview-img')).toHaveAttribute('src', list[0].src)
	await expect.poll(() => requests.includes(list[0].src)).toBe(true)
	await page.locator('.ant-image-preview-close').click()
	await expect(page.locator('.ant-image-preview-mask')).toHaveCount(0)
	await ready.getByRole('button', { name: '设为壁纸', exact: true }).click()
	await expect.poll(() => savedWallpaper).toBe(list[0].src)
})

test('a navigation permission failure dismisses an existing embedded page', async ({ page }) => {
	await page.clock.install()
	await api(page)
	await page.goto('/#/')
	const link = page.getByRole('link', { name: 'Loading app', exact: true })
	await link.click({ button: 'right' })
	await page.getByRole('menuitem', { name: '主地址：内嵌打开', exact: true }).click()
	await expect(page.locator('iframe.app-frame')).toBeVisible()
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({ json: { code: 403, msg: 'Permission changed' } }),
	)
	// Reconnection refetches stale queries while the embedded page is still open.
	await page.clock.fastForward(31_000)
	await page.evaluate(() => window.dispatchEvent(new Event('offline')))
	await page.evaluate(() => window.dispatchEvent(new Event('online')))
	await expect(page.locator('.home-navigation-state .status-state')).toBeVisible()
	await expect(page.locator('iframe.app-frame')).toHaveCount(0)
	await expect(link).toHaveCount(0)
	await page.unroute('**/api/panel/itemIconGroup/getNavigation')
	await page.getByRole('button', { name: '重试', exact: true }).click()
	await expect(link).toBeVisible()
	await expect(page.locator('iframe.app-frame, .item-action-popup, .drag-handle')).toHaveCount(0)
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('sorting keeps focus outside replaceable items while its code is loading', async ({ page }) => {
	await api(page)
	const sortingGate = gate()
	let requested = false
	await page.route('**/assets/Sortable-*.js', async (route) => {
		requested = true
		await sortingGate.waiting
		await route.continue()
	})
	try {
		await page.goto('/#/')
		const sort = page.getByRole('button', { name: 'Loading group 排序', exact: true })
		await sort.click()
		await expect.poll(() => requested).toBe(true)
		await expect(page.locator('.app-grid[aria-busy="true"]')).toHaveAttribute('inert', '')
		await expect(page.getByRole('button', { name: 'Loading group 完成', exact: true })).toBeFocused()
		await page.keyboard.press('Tab')
		expect(await page.evaluate(() => !!document.activeElement?.closest('.app-grid'))).toBe(false)
		sortingGate.release()
		await expect(page.locator('.drag-handle')).toHaveCount(2)
	} finally {
		sortingGate.release()
	}
})

test('records a reproducible cold home resource budget for 60 text icons', async ({ page }, info) => {
	await api(page)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: Array.from({ length: 3 }, (_, group) => ({
					id: group + 1,
					title: ['常用网站', '工作', '工具'][group],
					items: Array.from({ length: 20 }, (_, index) => ({
						...items[0],
						id: group * 100 + index + 1,
						title: `测试应用 ${group * 20 + index + 1}`,
					})),
				})),
			},
		}),
	)
	await page.goto('/#/')
	await expect(page.locator('.app-link')).toHaveCount(60)
	await page.waitForLoadState('networkidle')
	const resources = await page.evaluate(() =>
		performance.getEntriesByType('resource').map((entry) => {
			const resource = entry as PerformanceResourceTiming
			return {
				path: new URL(resource.name).pathname,
				start: resource.startTime,
				end: resource.responseEnd,
				encoded: resource.encodedBodySize,
				decoded: resource.decodedBodySize,
			}
		}),
	)
	const scripts = resources.filter(
		(resource) => resource.path.startsWith('/assets/') && resource.path.endsWith('.js'),
	)
	const budget = {
		fixture: '60 text icons, zh-CN, no wallpaper/footer/monitor, fresh context',
		scripts: scripts.length,
		jsDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decoded, 0),
		jsEncodedBytes: scripts.reduce((sum, resource) => sum + resource.encoded, 0),
		resources,
	}
	expect(scripts.length).toBeGreaterThan(0)
	expect(scripts.some((resource) => /\/Home-[^/]+\.js$/.test(resource.path))).toBe(true)
	expect(budget.jsDecodedBytes).toBeGreaterThan(0)
	expect(budget.jsEncodedBytes).toBeGreaterThan(0)
	expect(budget.jsDecodedBytes).toBeLessThan(1_100_000)
	await info.attach('cold-home-resources.json', {
		body: JSON.stringify(budget, null, 2),
		contentType: 'application/json',
	})
	await page.screenshot({ path: info.outputPath('cold-home.png'), animations: 'disabled' })
})

test('navigation failures stay visible through pending retries and recover without false empty content', async ({
	page,
}) => {
	await api(page)
	let phase: 'failure' | 'pending' | 'ready' = 'failure'
	let attempts = 0
	const retryGate = gate()
	await page.route('**/api/panel/itemIconGroup/getNavigation', async (route) => {
		attempts++
		if (phase === 'pending') await retryGate.waiting
		return route.fulfill({
			json:
				phase === 'ready'
					? { code: 0, data: [{ id: 6100, title: 'Loading group', items }] }
					: { code: 500, msg: 'Temporary read failure' },
		})
	})
	try {
		await page.goto('/#/')
		const error = page.locator('.home-navigation-state .status-state')
		await expect(error).toBeVisible()
		await expect(page.locator('.home-logo-text')).toHaveText('Loading home')
		phase = 'pending'
		const retry = error.getByRole('button', { name: '重试', exact: true })
		await retry.click()
		await expect(retry).toHaveClass(/ant-btn-loading/)
		await retry.press('Enter')
		expect(attempts).toBe(2)
		await expect(error).toBeVisible()
		await expect(page.locator('.empty-collection, .home-navigation-state .loading-state')).toHaveCount(0)
		phase = 'failure'
		retryGate.release()
		await expect(retry).not.toHaveClass(/ant-btn-loading/)
		await expect(error).toBeVisible()
		phase = 'ready'
		await retry.click()
		await expect(page.getByRole('link', { name: 'Loading app', exact: true })).toBeVisible()
		await expect(page.locator('.home-navigation-state')).toHaveCount(0)
	} finally {
		retryGate.release()
	}
})
