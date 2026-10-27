import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

let admin: { token: string; id: number }
const success = { code: 0, data: null }
async function enter(page: Page, path = '/') {
	await page.addInitScript(
		(user) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: user.token,
						accounts: [{ token: user.token, user }],
						language: 'zh-CN',
						theme: 'light',
						network: 'wan',
					},
				}),
			),
		admin,
	)
	await page.goto(`/#${path}`)
}
function backup() {
	const data = {
		version: 1,
		appName: 'ZPanel-Config',
		exportTime: '',
		appVersion: '1.2.4',
		icons: [{ title: 'Boundary import', sort: 0, children: [] }],
	}
	return {
		name: 'boundary.zpanel.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({ ...data, md5: createHash('md5').update(JSON.stringify(data)).digest('hex') }),
		),
	}
}
test.beforeAll(async ({ request }) => {
	const result = await (
		await request.post('/api/login', { data: { username: 'admin@zpanel.local', password: '12345678' } })
	).json()
	expect(result.code).toBe(0)
	admin = result.data
})

test('group sorting cancels with Escape and supports pointer drop without editing', async ({ page }) => {
	const groups = [
		{ id: 901, title: 'First boundary group', items: [] },
		{ id: 902, title: 'Second boundary group', items: [] },
	]
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({ json: { code: 0, data: groups } }),
	)
	const sorts: { sortItems: { id: number }[] }[] = []
	await page.route('**/api/panel/itemIconGroup/saveSort', (route) => {
		sorts.push(route.request().postDataJSON())
		return route.fulfill({ json: success })
	})
	await enter(page, '/settings/groups')
	const handles = page.getByRole('button', { name: /拖动排序，也可按空格和方向键操作/ })
	await handles.first().focus()
	await page.keyboard.press('Space', { delay: 100 })
	await expect(handles.first()).toHaveAttribute('aria-pressed', 'true')
	await page.keyboard.press('ArrowDown', { delay: 100 })
	await page.keyboard.press('Escape', { delay: 100 })
	await expect(handles.first()).not.toHaveAttribute('aria-pressed', 'true')
	await expect(handles.first()).toBeFocused()
	expect(sorts).toHaveLength(0)
	const from = (await handles.first().boundingBox())!
	const to = (await handles.last().boundingBox())!
	await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
	await page.mouse.down()
	await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2)
	await expect(handles.first()).toHaveAttribute('aria-pressed', 'true')
	await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
	await expect(page.getByRole('status')).toContainText('First boundary group已移到第 2 项，共 2 项')
	await page.mouse.up()
	await expect.poll(() => sorts.length).toBe(1)
	expect(sorts[0].sortItems.map((item) => item.id)).toEqual([902, 901])
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('native modified and middle clicks bypass iframe interception and retain link destinations', async ({
	page,
	context,
}) => {
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: [
					{
						id: 901,
						title: 'Links',
						items: [
							{
								id: 903,
								title: 'Boundary native link',
								url: '/favicon.svg?boundary=native',
								openMethod: 3,
								icon: null,
							},
						],
					},
				],
			},
		}),
	)
	await enter(page)
	const link = page.getByRole('link', { name: 'Boundary native link', exact: true })
	for (const options of [
		{ button: 'middle' as const },
		{ modifiers: ['ControlOrMeta'] as 'ControlOrMeta'[] },
	]) {
		const opened = context.waitForEvent('page')
		await link.click(options)
		const popup = await opened
		await expect(popup).toHaveURL(/boundary=native/)
		await popup.close()
		await expect(page.getByRole('dialog')).toHaveCount(0)
	}
	await link.click()
	await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', '/favicon.svg?boundary=native')
	await page.keyboard.press('Escape', { delay: 100 })
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(link).toBeFocused()
})

test('user editor remains locked through delayed saving and failed saves keep the draft', async ({
	page,
}) => {
	await page.route('**/api/panel/users/getList', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { count: 1, list: [{ id: 902, username: 'boundary-user', name: 'Boundary', role: 2 }] },
			},
		}),
	)
	let release!: () => void
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/api/panel/users/update', async (route) => {
		await pending
		return route.fulfill({ json: { code: 1200 } })
	})
	await enter(page, '/settings/users')
	await page.getByRole('button', { name: '编辑', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('昵称', { exact: true }).fill('Boundary draft')
	await dialog.getByRole('button', { name: /确.*定/ }).click()
	try {
		await expect(dialog.getByRole('button', { name: /取.*消/ })).toBeDisabled()
		await expect(page.getByRole('button', { name: '添加', exact: true })).toBeDisabled()
		await page.keyboard.press('Escape', { delay: 100 })
		await expect(dialog).toBeVisible()
	} finally {
		release()
	}
	await expect(dialog.getByLabel('昵称', { exact: true })).toBeEnabled()
	await expect(dialog.getByLabel('昵称', { exact: true })).toHaveValue('Boundary draft')
})

test('public access retries the confirmed target and cancel does not toggle it', async ({ page }) => {
	let publicId: number | null = null
	let attempts = 0
	await page.route('**/api/panel/users/getList', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { count: 1, list: [{ id: 902, username: 'boundary-public-user', name: 'Boundary', role: 2 }] },
			},
		}),
	)
	await page.route('**/api/panel/users/getPublicVisitUser', (route) =>
		route.fulfill({ json: publicId ? { code: 0, data: { id: publicId } } : { code: 1202 } }),
	)
	await page.route('**/api/panel/users/setPublicVisitUser', (route) => {
		attempts++
		expect(route.request().postDataJSON().userId).toBe(902)
		if (attempts === 1) return route.fulfill({ json: { code: 1200 } })
		publicId = 902
		return route.fulfill({ json: success })
	})
	await enter(page, '/settings/users')
	await page.getByRole('button', { name: '未开启', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('button', { name: /确.*定/ }).click()
	await expect(dialog.getByRole('button', { name: /确.*定/ })).not.toHaveClass(/loading/)
	await dialog.getByRole('button', { name: /确.*定/ }).click()
	await expect(page.getByRole('button', { name: '已开启', exact: true })).toBeVisible()
	await page.getByRole('button', { name: '已开启', exact: true }).click()
	await dialog.getByRole('button', { name: /取.*消/ }).click()
	expect(attempts).toBe(2)
})

test('backup retries reuse the receipt and replace confirmation freezes the preview', async ({ page }) => {
	const receipts: string[] = []
	await page.route('**/api/panel/userConfig/import', (route) => {
		receipts.push(route.request().postDataJSON().requestId)
		return route.fulfill({ json: receipts.length === 1 ? { code: 1200 } : success })
	})
	await enter(page, '/settings/backup')
	await page.locator('input[type=file]').setInputFiles(backup())
	await page.getByRole('button', { name: '导入配置', exact: true }).click()
	await expect(page.getByRole('button', { name: '导入配置', exact: true })).not.toHaveClass(/loading/)
	await page.getByRole('button', { name: '导入配置', exact: true }).click()
	await expect.poll(() => receipts.length).toBe(2)
	expect(receipts[0]).toBe(receipts[1])
	await expect(page.getByText('boundary.zpanel.json', { exact: true })).toHaveCount(0)
	await expect(page.locator('input[type=file]')).toBeEnabled()
	await page.locator('input[type=file]').setInputFiles(backup())
	await page.getByRole('radio', { name: '覆盖', exact: true }).check()
	await page.getByRole('button', { name: '导入配置', exact: true }).click()
	await expect(page.getByRole('dialog')).toBeVisible()
	await expect(page.locator('input[type=file]')).toBeDisabled()
	await expect(page.getByRole('radio', { name: '追加', exact: true })).toBeDisabled()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	await expect(page.locator('input[type=file]')).toBeEnabled()
	expect(receipts).toHaveLength(2)
})

test('export read failures produce no download and successful export releases its object URL', async ({
	page,
}) => {
	await page.addInitScript(() => {
		const original = URL.revokeObjectURL
		URL.revokeObjectURL = (url) => {
			document.documentElement.dataset.revokedExport = url
			original(url)
		}
	})
	let fail = true
	let reads = 0
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) => {
		reads++
		return route.fulfill({ json: fail ? { code: 1200 } : { code: 0, data: [] } })
	})
	await enter(page, '/settings/backup')
	await expect(page.getByRole('button', { name: '导出配置', exact: true })).toBeVisible()
	let downloads = 0
	page.on('download', () => {
		downloads++
	})
	await page.getByRole('button', { name: '导出配置', exact: true }).click()
	await expect.poll(() => reads).toBeGreaterThan(1)
	await expect(page.getByRole('button', { name: '导出配置', exact: true })).not.toHaveClass(/loading/)
	expect(downloads).toBe(0)
	fail = false
	const download = page.waitForEvent('download')
	await page.getByRole('button', { name: '导出配置', exact: true }).click()
	expect((await download).suggestedFilename()).toMatch(/\.zpanel\.json$/)
	await expect(page.locator('html')).toHaveAttribute('data-revoked-export', /^blob:/)
})

test('mobile settings selection handles leave cancellation and unknown routes recover', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await enter(page, '/settings/appearance')
	const draft = 'Mobile draft'.repeat(20)
	await page.getByLabel('面板名称').fill(draft)
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'invalid')
	await page.getByRole('combobox', { name: '设置', exact: true }).click()
	await page.locator('.ant-select-dropdown:visible').getByText('导航分组', { exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	await expect(page.locator('.mobile-settings-nav')).toContainText('风格设置')
	await expect(page.getByLabel('面板名称')).toHaveValue(draft)
	await page.getByRole('combobox', { name: '设置', exact: true }).click()
	await page.locator('.ant-select-dropdown:visible').getByText('导航分组', { exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page).toHaveURL(/settings\/groups/)
	await page.goto('/#/missing-boundary-page')
	await expect(page.getByText('404', { exact: true })).toBeVisible()
	await page.getByRole('link', { name: '返回首页', exact: true }).click()
	await expect(page.locator('.home-hero')).toBeVisible()
})

test('confirmed account switching discards password drafts and reaches the new home once', async ({
	page,
}) => {
	const next = {
		token: 'boundary-next-token',
		user: { id: 902, username: 'boundary-next', name: 'Boundary next', role: 2 },
	}
	await page.addInitScript(
		({ admin, next }) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: admin.token,
						accounts: [{ token: admin.token, user: admin }, next],
						language: 'zh-CN',
						theme: 'light',
					},
				}),
			),
		{ admin, next },
	)
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.request().headers().token === next.token
			? route.fulfill({ json: { code: 0, data: { user: next.user, visitMode: 0 } } })
			: route.continue(),
	)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({ json: { code: 0, data: [{ id: 901, title: 'Boundary next home', items: [] }] } }),
	)
	await page.route('**/api/panel/userConfig/get', (route) => route.fulfill({ json: { code: 1202 } }))
	await page.route('**/api/system/moduleConfig/getByName', (route) =>
		route.fulfill({ json: { code: 0, data: null } }),
	)
	await page.goto('/#/settings/account')
	await page.getByLabel('旧密码', { exact: true }).fill('Draft password')
	await page.getByRole('button', { name: '切换', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	await expect(page.getByLabel('旧密码', { exact: true })).toHaveValue('Draft password')
	await page.getByRole('button', { name: '切换', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page).toHaveURL(/\/#\/$/)
	await expect(page.getByRole('heading', { name: 'Boundary next home', exact: true })).toBeVisible()
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('confirmed logout with a password draft reaches login without a second leave dialog', async ({
	page,
}) => {
	await page.route('**/api/logout', (route) => route.fulfill({ json: success }))
	await enter(page, '/settings/account')
	await page.getByLabel('旧密码', { exact: true }).fill('Draft password')
	await page.getByRole('button', { name: '退出登录', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page).toHaveURL(/login/)
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('desktop and mobile page surfaces render without overflow or runtime errors', async ({ page }) => {
	test.setTimeout(60_000)
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await enter(page)
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
		for (const section of [
			'home',
			'login',
			'appearance',
			'groups',
			'modules',
			'files',
			'backup',
			'account',
			'users',
			'docker',
			'site',
			'about',
		]) {
			await page.goto(
				section === 'home' ? '/#/' : section === 'login' ? '/#/login' : `/#/settings/${section}`,
			)
			await expect(
				page
					.locator(
						section === 'home' ? '.home-hero' : section === 'login' ? '.login-form' : '.settings-section',
					)
					.first(),
			).toBeVisible()
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
				.toBe(true)
			await page.screenshot({
				path: `test-results/event-visuals/${width}-${section}.png`,
				fullPage: true,
				animations: 'disabled',
			})
			if (['appearance', 'modules', 'account', 'site'].includes(section)) {
				const scroller = (await page.locator('.settings-form-content').count())
					? page.locator('.settings-form-content')
					: page.locator('.settings-body')
				await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
				await page.screenshot({
					path: `test-results/event-visuals/${width}-${section}-bottom.png`,
					fullPage: true,
					animations: 'disabled',
				})
			}
		}
	}
	expect(errors).toEqual([])
})

test('mobile account table can scroll to edit and delete actions', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	let name = 'Mobile user'
	let deleted = false
	await page.route('**/api/panel/users/getList', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					count: deleted ? 0 : 1,
					list: deleted ? [] : [{ id: 902, username: 'boundary-mobile-user', name, role: 2 }],
				},
			},
		}),
	)
	await page.route('**/api/panel/users/update', (route) => {
		name = route.request().postDataJSON().name
		return route.fulfill({ json: success })
	})
	await page.route('**/api/panel/users/deletes', (route) => {
		deleted = true
		return route.fulfill({ json: success })
	})
	await enter(page, '/settings/users')
	const row = page.getByRole('row').filter({ hasText: 'boundary-mobile-user' })
	await expect(row).toBeVisible()
	const content = page.locator('.ant-table-content')
	await content.evaluate((element) => element.scrollTo({ left: element.scrollWidth }))
	await expect(row.getByRole('button', { name: '编辑', exact: true })).toBeInViewport()
	await row.getByRole('button', { name: '编辑', exact: true }).click()
	await page.getByRole('dialog').getByLabel('昵称', { exact: true }).fill('Edited mobile')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect.poll(() => name).toBe('Edited mobile')
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await content.evaluate((element) => element.scrollTo({ left: element.scrollWidth }))
	await row.getByRole('button', { name: '删除', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	expect(deleted).toBe(false)
	await row.getByRole('button', { name: '删除', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(row).toHaveCount(0)
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
