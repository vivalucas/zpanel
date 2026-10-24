import { chromium, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

let account: { token: string; id: number }
let fixture = 0
const menuApp = {
	id: 981,
	title: 'Menu app',
	url: '/favicon.svg?menu=address',
	lanUrl: '/favicon.svg?menu=lan',
	openMethod: 3,
	itemIconGroupId: 980,
	icon: null,
}
async function home(page: Page, app = {}, panel = {}, guest = false) {
	await page.addInitScript((user) => {
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
					homeEditHintDismissed: true,
				},
			}),
		)
	}, account)
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { user: { ...account, role: 2 }, visitMode: guest ? 1 : 0 },
			},
		}),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					panel: { iconStyle: 1, marginTop: 2, marginBottom: 2, searchBoxSearchIcon: true, ...panel },
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
					{
						id: 980,
						title: 'Menu group',
						items: [
							{ ...menuApp, ...app },
							{ ...menuApp, id: 982, title: 'Other app', openMethod: 2 },
						],
					},
					{ id: 983, title: 'Empty group', items: [] },
				],
			},
		}),
	)
	// A new document is required when one test changes the mocked account or navigation.
	await page.goto(`/?menuFixture=${++fixture}#/`)
	await expect(page.getByText('Menu app', { exact: true })).toBeVisible()
}
const link = (page: Page) => page.getByRole('link', { name: 'Menu app', exact: true })
const popup = (page: Page) => page.locator('.item-action-popup')
const action = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true })
test.beforeAll(async ({ request }) => {
	const result = await (
		await request.post('/api/login', { data: { username: 'admin@zpanel.local', password: '12345678' } })
	).json()
	expect(result.code).toBe(0)
	account = result.data
})

test('right click and more share one menu, explicit addresses and methods override only this opening', async ({
	page,
}) => {
	let writes = 0
	await page.route('**/api/panel/itemIcon/edit', (route) => {
		writes++
		return route.fulfill({ json: { code: 0 } })
	})
	await home(page)
	await expect(page.getByRole('button', { name: '导入配置', exact: true })).toHaveCount(0)
	await link(page).click()
	await expect(popup(page)).toHaveCount(0)
	await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', menuApp.url)
	await page.keyboard.press('Escape')
	await page.getByRole('button', { name: '外网', exact: true }).click()
	await expect(link(page)).toHaveAttribute('href', menuApp.lanUrl)
	await link(page).click({ button: 'right' })
	await expect(popup(page)).toHaveCount(1)
	await action(page, '打开地址').click()
	await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', menuApp.url)
	await expect(popup(page)).toHaveCount(0)
	await page.keyboard.press('Escape')
	await link(page).click({ button: 'right' })
	const opened = page.waitForEvent('popup')
	await action(page, '内网地址：新标签页打开').click()
	const tab = await opened
	await expect(tab).toHaveURL(/menu=lan/)
	await tab.close()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await page.getByRole('button', { name: '更多操作 Menu app', exact: true }).click()
	await expect(popup(page)).toHaveCount(1)
	await page.getByRole('link', { name: 'Other app', exact: true }).click({ button: 'right' })
	await expect(popup(page)).toHaveCount(1)
	await expect(page.getByRole('menu', { name: '更多操作 Other app', exact: true })).toBeVisible()
	await action(page, '内网地址：内嵌打开').click()
	await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', menuApp.lanUrl)
	expect(writes).toBe(0)
})

test('primary address operations retain the configured current-page opening', async ({ page }) => {
	await home(page, { openMethod: 1 })
	await link(page).click({ button: 'right' })
	await action(page, '打开内网地址').click()
	await expect(page).toHaveURL(/favicon.svg\?menu=lan/)
})

test('keyboard menus restore focus, preserve native shortcuts and pass through Shift right click', async ({
	page,
	context,
}) => {
	await home(page)
	const prevented = await link(page).evaluate((element) => {
		const normal = new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
			clientX: 60,
			clientY: 80,
		})
		element.dispatchEvent(normal)
		const shifted = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, shiftKey: true })
		element.dispatchEvent(shifted)
		return [normal.defaultPrevented, shifted.defaultPrevented]
	})
	expect(prevented).toEqual([true, false])
	await expect(popup(page)).toHaveCount(0)
	await link(page).focus()
	await page.keyboard.press('Shift+F10')
	await expect(action(page, '打开地址')).toBeFocused()
	await page.keyboard.press('ArrowDown')
	await expect(action(page, '地址：新标签页打开')).toBeFocused()
	await page.keyboard.press('ArrowRight')
	await expect(action(page, '地址：内嵌打开')).toBeFocused()
	await page.keyboard.press('ArrowLeft')
	await expect(action(page, '地址：新标签页打开')).toBeFocused()
	await page.keyboard.press('End')
	await expect(action(page, '删除')).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(link(page)).toBeFocused()
	const more = page.getByRole('button', { name: '更多操作 Menu app', exact: true })
	await more.focus()
	await page.keyboard.press('Enter')
	await expect(action(page, '打开地址')).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(popup(page)).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Other app', exact: true })).toBeFocused()
	for (const options of [
		{ button: 'middle' as const },
		{ modifiers: ['ControlOrMeta'] as 'ControlOrMeta'[] },
	]) {
		const opened = context.waitForEvent('page')
		await link(page).click(options)
		const tab = await opened
		await expect(tab).toHaveURL(/menu=address/)
		await tab.close()
		await expect(popup(page)).toHaveCount(0)
	}
})

test('clipboard success waits for completion and copies the selected absolute address', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: (address: string) =>
					new Promise<void>((resolve) =>
						Object.assign(window, { copiedAddress: address, finishCopy: resolve }),
					),
			},
		}),
	)
	await home(page)
	await link(page).click({ button: 'right' })
	await action(page, '内网地址：复制地址').click()
	await expect(page.getByText('地址已复制', { exact: true })).toHaveCount(0)
	expect(await page.evaluate(() => (window as unknown as { copiedAddress: string }).copiedAddress)).toBe(
		`http://127.0.0.1:16521${menuApp.lanUrl}`,
	)
	await page.evaluate(() => (window as unknown as { finishCopy: () => void }).finishCopy())
	await expect(page.getByText('地址已复制', { exact: true })).toBeVisible()
	await expect(link(page)).toBeFocused()
})

for (const mode of ['missing', 'denied'] as const) {
	test(`clipboard ${mode} exposes a selected manual-copy address and no success message`, async ({
		page,
	}) => {
		await page.addInitScript(
			(mode) =>
				Object.defineProperty(navigator, 'clipboard', {
					configurable: true,
					value:
						mode === 'missing'
							? undefined
							: {
									writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')),
								},
				}),
			mode,
		)
		await home(page)
		await link(page).click({ button: 'right' })
		await action(page, '地址：复制地址').click()
		const input = page.getByRole('dialog').getByRole('textbox', { name: '地址', exact: true })
		await expect(input).toHaveValue(`http://127.0.0.1:16521${menuApp.url}`)
		await expect(input).toBeFocused()
		expect(
			await input.evaluate((element: HTMLInputElement) => element.selectionEnd! - element.selectionStart!),
		).toBe(`http://127.0.0.1:16521${menuApp.url}`.length)
		await expect(page.getByText('地址已复制', { exact: true })).toHaveCount(0)
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /确.*定/ })
			.click()
		await expect(page.getByRole('dialog')).toHaveCount(0)
	})
}

test('late clipboard rejection is ignored after leaving Home', async ({ page }) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: {
				writeText: () =>
					new Promise<void>((_, reject) =>
						Object.assign(window, { failCopy: () => reject(new Error('Denied')) }),
					),
			},
		}),
	)
	await home(page)
	await link(page).click({ button: 'right' })
	await action(page, '地址：复制地址').click()
	await page.evaluate(() => {
		location.hash = '/settings/about'
	})
	await expect(page.getByRole('heading', { name: 'ZPanel', exact: true })).toBeVisible()
	await page.evaluate(() => (window as unknown as { failCopy: () => void }).failCopy())
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(page.getByText('地址已复制', { exact: true })).toHaveCount(0)
})

test('an insecure HTTP origin offers manual copying without Clipboard API', async () => {
	const browser = await chromium.launch()
	try {
		const context = await browser.newContext({ baseURL: 'http://menu-lan.test:16521' })
		const page = await context.newPage()
		// Serve the isolated backend at a non-localhost origin without depending on DNS/proxy settings.
		// The browser retains the insecure HTTP origin; its security context and Clipboard API are real.
		await page.route('http://menu-lan.test:16521/**', async (route) => {
			const url = new URL(route.request().url())
			url.hostname = '127.0.0.1'
			await route.fulfill({ response: await route.fetch({ url: url.href }) })
		})
		await home(page)
		expect(await page.evaluate(() => window.isSecureContext)).toBe(false)
		expect(await page.evaluate(() => typeof navigator.clipboard)).toBe('undefined')
		await link(page).click({ button: 'right' })
		await action(page, '内网地址：复制地址').click()
		await expect(page.getByRole('dialog').getByRole('textbox', { name: '地址', exact: true })).toHaveValue(
			`http://menu-lan.test:16521${menuApp.lanUrl}`,
		)
	} finally {
		await browser.close()
	}
})

test('LAN-only visitors have one address section, no management actions, and unsafe URLs are disabled', async ({
	page,
}) => {
	await home(page, { url: '' }, {}, true)
	await expect(link(page)).toHaveAttribute('href', menuApp.lanUrl)
	await link(page).click({ button: 'right' })
	await expect(page.getByRole('menuitem')).toHaveCount(4)
	await expect(action(page, '打开地址')).toHaveCount(0)
	await expect(action(page, '编辑')).toHaveCount(0)
	await expect(action(page, '删除')).toHaveCount(0)
	await home(page, { url: 'javascript:alert(1)', lanUrl: '' })
	await page.getByRole('button', { name: '更多操作 Menu app', exact: true }).click()
	await expect(action(page, '打开地址')).toHaveAttribute('aria-disabled', 'true')
	await expect(action(page, '地址：新标签页打开')).toHaveAttribute('aria-disabled', 'true')
	await expect(action(page, '编辑')).toBeFocused()
})

test('visitors can exit an entirely disabled menu with the keyboard and background right click remains native', async ({
	page,
}) => {
	await home(page, { url: 'javascript:alert(1)', lanUrl: '' }, {}, true)
	const more = page.getByRole('button', { name: '更多操作 Menu app', exact: true })
	await more.click()
	await expect(page.getByRole('menu', { name: '更多操作 Menu app', exact: true })).toBeFocused()
	await expect(page.getByRole('menuitem', { disabled: true })).toHaveCount(4)
	await page.keyboard.press('Escape')
	await expect(popup(page)).toHaveCount(0)
	await expect(more).toBeFocused()
	expect(
		await page.locator('main').evaluate((element) => {
			const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
			element.dispatchEvent(event)
			return event.defaultPrevented
		}),
	).toBe(false)
})

test('search, scrolling, outside clicks and sorting dismiss menus without enabling sorted app actions', async ({
	page,
}) => {
	await home(page)
	await link(page).click({ button: 'right' })
	await page.locator('.home-logo-text').click()
	await expect(popup(page)).toHaveCount(0)
	await link(page).click({ button: 'right' })
	await page.evaluate(() => window.dispatchEvent(new Event('scroll')))
	await expect(popup(page)).toHaveCount(0)
	await link(page).click({ button: 'right' })
	await page.getByRole('textbox', { name: '搜索', exact: true }).fill('missing app')
	await expect(popup(page)).toHaveCount(0)
	await page.getByRole('textbox', { name: '搜索', exact: true }).clear()
	await link(page).click({ button: 'right' })
	await page.getByRole('button', { name: 'Menu group 排序', exact: true }).focus()
	await page.keyboard.press('Enter')
	await expect(popup(page)).toHaveCount(0)
	await link(page).dispatchEvent('contextmenu', { clientX: 60, clientY: 80 })
	await expect(popup(page)).toHaveCount(0)
	await expect(page.getByRole('button', { name: '更多操作 Menu app', exact: true })).toHaveCount(0)
	await link(page).dispatchEvent('click')
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await page.getByRole('button', { name: 'Menu group 完成', exact: true }).focus()
	await page.keyboard.press('Enter')
	await expect(popup(page)).toHaveCount(0)
})

test('blocked embedding retains the external opening escape hatch', async ({ page }) => {
	await page.route('**/blocked-frame', (route) =>
		route.fulfill({ body: 'Cannot embed', headers: { 'X-Frame-Options': 'DENY' } }),
	)
	await home(page, { url: '/blocked-frame' })
	await link(page).click({ button: 'right' })
	await action(page, '地址：内嵌打开').click()
	await expect(
		page.getByRole('dialog').getByRole('link', { name: '新窗口打开', exact: true }),
	).toHaveAttribute('href', '/blocked-frame')
	await page.keyboard.press('Escape')
	await expect(link(page)).toBeFocused()
})

test('menu stays within desktop and mobile edges in both styles and themes', async ({ page }, info) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.route('**/menu-wallpaper.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><path fill="#102a39" d="M0 0h1600v1000H0z"/></svg>',
		}),
	)
	for (const style of [1, 2]) {
		await home(page, {}, { iconStyle: style, backgroundImageSrc: '/menu-wallpaper.svg' })
		for (const theme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: theme })
			for (const width of [320, 1440]) {
				await page.setViewportSize({ width, height: 700 })
				await page.evaluate(
					() =>
						new Promise<void>((resolve) =>
							requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
						),
				)
				await link(page).evaluate(
					(element, width) =>
						element.dispatchEvent(
							new MouseEvent('contextmenu', {
								bubbles: true,
								cancelable: true,
								clientX: width - 1,
								clientY: 699,
							}),
						),
					width,
				)
				await expect(popup(page)).toBeVisible()
				const bounds = await popup(page).boundingBox()
				expect(bounds!.x).toBeGreaterThanOrEqual(8)
				expect(bounds!.x).toBe(width - 232 - 8)
				expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 8)
				expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(692)
				await page.screenshot({
					path: info.outputPath(`menu-${style}-${theme}-${width}.png`),
					animations: 'disabled',
				})
				await page.keyboard.press('Escape')
			}
		}
	}
	await page.setViewportSize({ width: 320, height: 240 })
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
	)
	await link(page).evaluate((element) =>
		element.dispatchEvent(
			new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 319, clientY: 239 }),
		),
	)
	await expect(popup(page)).toBeVisible()
	expect(await popup(page).evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
	await popup(page).evaluate((element) => {
		element.scrollTop = element.scrollHeight
	})
	await expect(action(page, '删除')).toBeInViewport()
	await expect(popup(page)).toBeVisible()
	await page.screenshot({ path: info.outputPath('menu-low-height.png'), animations: 'disabled' })
	expect(errors).toEqual([])
})

test('touch users open the same menu with more and can edit without navigation', async ({ browser }) => {
	const context = await browser.newContext({
		baseURL: 'http://127.0.0.1:16521',
		viewport: { width: 320, height: 700 },
		isMobile: true,
		hasTouch: true,
	})
	try {
		const page = await context.newPage()
		await home(page)
		await page.getByRole('button', { name: '更多操作 Menu app', exact: true }).tap()
		await expect(popup(page)).toBeVisible()
		await action(page, '编辑').tap()
		await expect(page.getByRole('dialog').getByLabel('标题', { exact: true })).toHaveValue('Menu app')
		await expect(popup(page)).toHaveCount(0)
	} finally {
		await context.close()
	}
})
