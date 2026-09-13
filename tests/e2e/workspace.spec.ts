import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

let admin: { token: string; id: number; username: string; name: string; role: number }
async function api(request: APIRequestContext, path: string, data: unknown = {}, token = admin.token) {
	const response = await request.post(`/api${path}`, { data, headers: { token } })
	expect(response.ok()).toBeTruthy()
	const result = await response.json()
	expect(result.code, `${path}: ${result.msg}`).toBe(0)
	return result.data
}
async function enter(page: Page, path = '/') {
	await page.addInitScript(
		(account) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					state: {
						token: account.token,
						accounts: [{ token: account.token, user: account }],
						theme: 'light',
						language: 'zh-CN',
						network: 'wan',
					},
					version: 1,
				}),
			),
		admin,
	)
	await page.goto(`/#${path}`)
}
test.beforeAll(async ({ request }) => {
	const response = await request.post('/api/login', {
		data: { username: 'admin@zpanel.local', password: '12345678' },
	})
	const result = await response.json()
	expect(result.code).toBe(0)
	admin = result.data
})
test('login, create a group and app, edit, search and keyboard-sort with persisted order', async ({
	page,
	request,
}) => {
	const errors: string[] = []
	page.on('pageerror', (err) => errors.push(err.message))
	await page.goto('/#/login')
	await page.getByLabel('账号', { exact: true }).fill('admin@zpanel.local')
	await page.getByLabel('密码', { exact: true }).fill('12345678')
	await page.getByRole('button', { name: '登录', exact: true }).click()
	await expect(page.getByRole('heading', { name: /我的应用/ })).toBeVisible()
	await page.goto('/#/settings/groups')
	await page.getByRole('button', { name: '添加', exact: true }).click()
	await page.getByLabel('标题').fill('工作空间')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page.getByText('工作空间', { exact: true })).toBeVisible()
	await page.goto('/#/')
	await page.getByRole('button', { name: '添加项目', exact: true }).first().click()
	await page.getByLabel('标题').fill('Project Atlas')
	await page.getByRole('combobox', { name: '分组', exact: true }).click()
	await page.getByTitle('工作空间', { exact: true }).click()
	await page.getByLabel('地址', { exact: true }).fill('https://example.com')
	await page.getByLabel('描述信息', { exact: true }).fill('项目文档与协作空间')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page.getByRole('button', { name: 'Project Atlas', exact: true })).toBeVisible()
	await page.getByRole('button', { name: '更多操作 Project Atlas' }).click()
	await page.getByRole('menuitem', { name: '编辑' }).click()
	await page.getByLabel('标题').fill('Project Atlas Updated')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page.getByRole('button', { name: 'Project Atlas Updated', exact: true })).toBeVisible()
	await page.getByRole('textbox', { name: '搜索', exact: true }).fill('no-such-app')
	await expect(page.getByText('没有找到匹配的应用')).toBeVisible()
	await page.getByRole('textbox', { name: '搜索', exact: true }).clear()
	const groups = await api(request, '/panel/itemIconGroup/getList')
	const group = groups.list.find((g: { title: string }) => g.title === '工作空间')
	await api(request, '/panel/itemIcon/edit', {
		title: 'Second App',
		url: 'https://example.org',
		openMethod: 2,
		itemIconGroupId: group.id,
		icon: null,
	})
	expect(
		(await api(request, '/panel/itemIcon/getListByGroupId', { itemIconGroupId: group.id })).list,
	).toHaveLength(2)
	await page.reload()
	await page.getByRole('button', { name: '排序', exact: true }).click()
	const handle = page.getByRole('button', { name: '拖动排序，也可按空格和方向键操作' }).first()
	await handle.focus()
	await page.keyboard.press('Space', { delay: 100 })
	await expect(handle).toHaveAttribute('aria-pressed', 'true')
	await page.keyboard.press('ArrowRight', { delay: 100 })
	await page.keyboard.press('Space', { delay: 100 })
	await expect(handle).not.toHaveAttribute('aria-pressed', 'true')
	await expect
		.poll(
			async () =>
				(await api(request, '/panel/itemIcon/getListByGroupId', { itemIconGroupId: group.id })).list[0].title,
		)
		.toBe('Second App')
	expect(errors).toEqual([])
})
test('appearance persists and dark/light theme reaches controls and home', async ({ page, request }) => {
	await enter(page, '/settings/appearance')
	await page.getByLabel('面板名称').fill('My Homelab')
	await page.getByRole('button', { name: '保存', exact: true }).click()
	await expect
		.poll(async () => (await api(request, '/panel/userConfig/get')).panel.logoText)
		.toBe('My Homelab')
	await page.getByRole('combobox', { name: '界面主题' }).click()
	await page.getByText('深色', { exact: true }).click()
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
	await page.keyboard.press('Escape')
	await expect
		.poll(() => page.getByLabel('面板名称').evaluate((el) => getComputedStyle(el).backgroundColor))
		.toBe('rgb(20, 20, 20)')
	await page.screenshot({ path: 'test-results/settings-dark.png', fullPage: true, animations: 'disabled' })
	await page.goto('/#/')
	await expect(page.getByRole('link', { name: 'Z My Homelab' })).toBeVisible()
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
test('search/monitor settings and site customizations save; safe mode disables custom code', async ({
	page,
	request,
}) => {
	await enter(page, '/settings/modules')
	await page.getByRole('button', { name: '保存', exact: true }).first().click()
	await expect
		.poll(
			async () =>
				(await api(request, '/system/moduleConfig/getByName', { name: 'module-deskModuleSearchBox' }))
					?.searchEngineList.length,
		)
		.toBeGreaterThan(0)
	await page.getByRole('button', { name: '保存', exact: true }).last().click()
	await expect
		.poll(
			async () =>
				(await api(request, '/system/moduleConfig/getByName', { name: 'module-systemMonitor' }))?.list.length,
		)
		.toBe(2)
	await page.goto('/#/settings/site')
	await page.getByLabel('站点标题', { exact: true }).fill('ZPanel Test')
	await page
		.getByLabel('JavaScript', { exact: true })
		.fill('document.documentElement.dataset.customTest = "yes"')
	await page.getByRole('button', { name: '保存', exact: true }).click()
	await expect(page).toHaveTitle('ZPanel Test')
	await expect(page.locator('html')).toHaveAttribute('data-custom-test', 'yes')
	await page.goto('/?safeMode=1#/')
	await expect(page.getByRole('heading', { name: /我的应用/ })).toBeVisible()
	await expect(page.locator('html')).not.toHaveAttribute('data-custom-test', 'yes')
})
test('file upload, wallpaper reference, export and import round trip', async ({ page, request }) => {
	await enter(page, '/settings/files')
	await page.locator('input[type=file]').setInputFiles({
		name: 'pixel.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
			'base64',
		),
	})
	await expect(page.getByText('pixel.png', { exact: true })).toBeVisible()
	await page.getByRole('button', { name: '设为壁纸' }).click()
	await expect
		.poll(async () => (await api(request, '/panel/userConfig/get')).panel.backgroundImageSrc)
		.toMatch(/^\/uploads\//)
	await page.getByRole('button', { name: '正在使用此图片的位置' }).click()
	await expect(page.getByRole('dialog')).toContainText('面板配置')
	await page.getByRole('button', { name: '关闭', exact: true }).click()
	await page.goto('/#/settings/backup')
	const downloadPromise = page.waitForEvent('download')
	await page.getByRole('button', { name: '导出配置', exact: true }).click()
	const download = await downloadPromise
	const file = await download.path()
	expect(file).toBeTruthy()
	await page.locator('input[type=file]').setInputFiles(file!)
	await expect(page.getByText(/包含.*个分组/)).toBeVisible()
	const before = (await api(request, '/panel/itemIconGroup/getList')).list.length
	await page.getByRole('button', { name: '导入配置', exact: true }).click()
	await expect
		.poll(async () => (await api(request, '/panel/itemIconGroup/getList')).list.length)
		.toBe(before * 2)
})
test('ordinary users cannot open admin pages; account switching and public mode isolate data', async ({
	page,
	request,
	browser,
}) => {
	const userInfo = await api(request, '/panel/users/create', {
		username: 'reader-test',
		name: 'Reader',
		role: 2,
		password: 'testpass123',
	})
	const user = await api(request, '/login', { username: 'reader-test', password: 'testpass123' }, '')
	await api(request, '/panel/itemIconGroup/edit', { title: 'Reader-only group' }, user.token)
	await page.addInitScript(
		({ admin, user }) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					state: {
						token: admin.token,
						accounts: [
							{ token: admin.token, user: admin },
							{ token: user.token, user },
						],
						theme: 'light',
						language: 'zh-CN',
						network: 'wan',
					},
					version: 1,
				}),
			),
		{ admin, user },
	)
	await page.goto('/#/settings/account')
	await page.getByRole('button', { name: '切换', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Reader-only group' })).toBeVisible()
	await expect(page.getByRole('heading', { name: '工作空间' })).toHaveCount(0)
	await page.goto('/#/settings/users')
	await expect(page.getByText('403', { exact: true })).toBeVisible()
	await api(request, '/panel/users/setPublicVisitUser', { userId: userInfo.id })
	const guest = await browser.newContext()
	const guestPage = await guest.newPage()
	await guestPage.goto('http://127.0.0.1:16521/#/')
	await expect(guestPage.getByRole('heading', { name: 'Reader-only group' })).toBeVisible()
	await expect(guestPage.getByRole('button', { name: '添加项目' })).toHaveCount(0)
	await guest.close()
	await api(request, '/panel/users/setPublicVisitUser', { userId: null })
})
test('desktop and mobile pages have no overflow or runtime errors, and Docker failure is visible', async ({
	page,
	request,
}) => {
	const config = await api(request, '/panel/userConfig/get')
	config.panel.backgroundImageSrc = ''
	config.panel.systemMonitorShow = true
	await api(request, '/panel/userConfig/set', config)
	const errors: string[] = []
	page.on('pageerror', (err) => errors.push(err.message))
	await enter(page)
	await expect(page.getByRole('heading', { name: /我的应用/ })).toBeVisible()
	await expect(page.locator('.monitor-card')).toHaveCount(2)
	await expect(page.locator('.monitor-card strong')).toHaveCount(2)
	await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })
	await page.setViewportSize({ width: 390, height: 844 })
	await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true })
	for (const path of [
		'/',
		'/settings/appearance',
		'/settings/groups',
		'/settings/modules',
		'/settings/files',
		'/settings/account',
		'/settings/users',
		'/settings/site',
		'/settings/about',
	]) {
		await page.goto(`/#${path}`)
		await expect(page.locator(path === '/' ? '.home-toolbar' : '.settings-section').first()).toBeVisible()
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
			.toBeTruthy()
	}
	await page.goto('/#/settings/docker')
	await expect(page.getByRole('alert')).toBeVisible()
	expect(errors).toEqual([])
})
