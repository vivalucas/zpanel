import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'
let admin: { token: string }
async function api(request: APIRequestContext, path: string, data: unknown = {}) {
	const result = await (await request.post(`/api${path}`, { data, headers: { token: admin.token } })).json()
	expect(result.code, `${path}: ${result.msg}`).toBe(0)
	return result.data
}
async function enter(page: Page, path: string) {
	await page.addInitScript(
		(user) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: user.token,
						accounts: [{ token: user.token, user }],
						theme: 'light',
						language: 'zh-CN',
						network: 'wan',
					},
				}),
			),
		admin,
	)
	await page.goto(`/#${path}`)
}
test.beforeAll(async ({ request }) => {
	const result = await (
		await request.post('/api/login', { data: { username: 'admin@zpanel.local', password: '12345678' } })
	).json()
	expect(result.code).toBe(0)
	admin = result.data
})
test('HTTP LAN without randomUUID opens login and refreshes captcha after failed login', async ({ page }) => {
	const errors: string[] = []
	page.on('pageerror', (err) => errors.push(err.message))
	await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined }))
	await page.route('**/api/openness/loginConfig', async (route) => {
		const response = await route.fetch()
		const data = await response.json()
		data.data.loginCaptcha = true
		await route.fulfill({ json: data })
	})
	await page.route('**/api/login', (route) => route.fulfill({ json: { code: 1002, msg: 'Invalid captcha' } }))
	await page.goto('/#/login')
	await page.getByLabel('账号', { exact: true }).fill('admin@zpanel.local')
	await page.getByLabel('密码', { exact: true }).fill('12345678')
	await page.locator('input[maxlength="6"]').fill('000000')
	const captcha = page.locator('.captcha img')
	const before = await captcha.getAttribute('src')
	await page.getByRole('button', { name: '登录', exact: true }).click()
	await expect(captcha).not.toHaveAttribute('src', before!)
	await expect(page.locator('button[type=submit]')).not.toHaveClass(/ant-btn-loading/)
	await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled()
	expect(errors).toEqual([])
})
test('failed appearance saves preserve drafts, block navigation, and successful retry locks inputs', async ({
	page,
}) => {
	await enter(page, '/settings/appearance')
	await page.getByLabel('面板名称').fill('Retained draft')
	await page.route('**/api/panel/userConfig/set', (route) =>
		route.fulfill({ json: { code: 1200, msg: 'Database failed' } }),
	)
	await page.getByRole('button', { name: '保存', exact: true }).click()
	await expect(page.getByLabel('面板名称')).toHaveValue('Retained draft')
	await page.getByRole('menuitem', { name: '导航分组', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toContainText('放弃未保存')
	await dialog.getByRole('button', { name: /取.*消/ }).click()
	await expect(page.getByLabel('面板名称')).toHaveValue('Retained draft')
	await page.unroute('**/api/panel/userConfig/set')
	let release!: () => void
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/api/panel/userConfig/set', async (route) => {
		await pending
		await route.continue()
	})
	await page.getByRole('button', { name: '保存', exact: true }).click()
	await expect(page.getByLabel('面板名称')).toBeDisabled()
	release()
	await expect(page.getByLabel('面板名称')).toBeEnabled()
	await expect(page.getByLabel('面板名称')).toHaveValue('Retained draft')
	await page.getByRole('menuitem', { name: '导航分组', exact: true }).click()
	await expect(page).toHaveURL(/settings\/groups/)
})
test('removing an earlier search engine preserves the selected default and reloads it', async ({
	page,
	request,
}) => {
	const name = 'module-deskModuleSearchBox'
	const original = await api(request, '/system/moduleConfig/getByName', { name })
	const engines = ['Alpha', 'Beta', 'Gamma'].map((title) => ({
		title,
		url: `https://example.com/${title}?q=%s`,
	}))
	await api(request, '/system/moduleConfig/save', {
		name,
		value: { searchEngineList: engines, currentSearchEngine: engines[2], newWindowOpen: true },
	})
	try {
		await enter(page, '/settings/modules')
		await page.locator('form').first().getByRole('button', { name: '删除', exact: true }).first().click()
		await page.getByRole('button', { name: '保存', exact: true }).first().click()
		await expect
			.poll(
				async () => (await api(request, '/system/moduleConfig/getByName', { name })).searchEngineList.length,
			)
			.toBe(2)
		expect((await api(request, '/system/moduleConfig/getByName', { name })).currentSearchEngine.title).toBe(
			'Gamma',
		)
		await page.reload()
		await expect(page.locator('form').first()).toContainText('2')
	} finally {
		await api(request, '/system/moduleConfig/save', {
			name,
			value: original || { searchEngineList: engines, currentSearchEngine: engines[0], newWindowOpen: true },
		})
	}
})
test('custom JavaScript is not rerun by unrelated site changes; hash safe mode clears it', async ({
	page,
	request,
}) => {
	const original = await api(request, '/system/siteSetting/get')
	await api(request, '/system/siteSetting/set', {
		...original.siteSetting,
		loginCaptcha: false,
		customJs:
			'document.documentElement.dataset.runCount=String(Number(document.documentElement.dataset.runCount||0)+1)',
	})
	try {
		await enter(page, '/settings/site')
		await expect(page.locator('html')).toHaveAttribute('data-run-count', '1')
		await page.getByLabel('站点标题', { exact: true }).fill('Audit title')
		await page.getByRole('button', { name: '保存', exact: true }).click()
		await expect(page).toHaveTitle('Audit title')
		await expect(page.locator('html')).toHaveAttribute('data-run-count', '1')
		await page.goto('/#/settings/site?safeMode=1')
		await expect(page.getByLabel('站点标题', { exact: true })).toBeVisible()
		await expect(page.locator('html')).not.toHaveAttribute('data-run-count')
	} finally {
		await api(request, '/system/siteSetting/set', {
			...original.siteSetting,
			loginCaptcha: original.loginCaptcha,
		})
	}
})
test('Docker action confirmation, failed action retry and log controls match the API contract', async ({
	page,
}) => {
	let running = false
	let fail = true
	await page.route('**/api/system/docker/containers', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					count: 1,
					list: [
						{
							id: 'abc123',
							names: 'audit-container',
							image: 'nginx',
							state: running ? 'running' : 'exited',
							status: running ? 'Up' : 'Exited',
							ports: '80/tcp',
						},
					],
				},
			},
		}),
	)
	await page.route('**/api/system/docker/stats', (route) =>
		route.fulfill({
			json: { code: 0, data: [{ ID: 'abc123', CPUPerc: '1.0%', MemUsage: '2MiB', NetIO: '0B' }] },
		}),
	)
	await page.route('**/api/system/docker/action', (route) => {
		expect(route.request().postDataJSON()).toEqual({ id: 'abc123', action: 'start' })
		if (fail) {
			fail = false
			return route.fulfill({ json: { code: -1, msg: 'Docker test failure' } })
		}
		running = true
		return route.fulfill({ json: { code: 0 } })
	})
	await page.route('**/api/system/docker/logs', (route) =>
		route.fulfill({ json: { code: 0, data: { logs: `audit log ${route.request().postDataJSON().lines}` } } }),
	)
	await enter(page, '/settings/docker')
	const row = page.getByRole('row').filter({ hasText: 'audit-container' })
	await expect(row.getByRole('button', { name: '停止', exact: true })).toBeDisabled()
	await row.getByRole('button', { name: '启动', exact: true }).click()
	const confirm = page.getByRole('dialog')
	await confirm.getByRole('button', { name: /确.*定/ }).click()
	await expect(page.getByText('Docker test failure', { exact: true })).toBeVisible()
	await confirm.getByRole('button', { name: /确.*定/ }).click()
	await expect(row.getByRole('button', { name: '停止', exact: true })).toBeEnabled()
	await row.getByRole('button', { name: '日志', exact: true }).click()
	await expect(page.locator('.log-output')).toContainText('audit log 200')
})
test('unknown settings routes return 404 and both mobile admin routes fit', async ({ page }) => {
	await enter(page, '/settings/missing-page')
	await expect(page.getByText('404', { exact: true })).toBeVisible()
	await page.setViewportSize({ width: 360, height: 780 })
	for (const path of ['backup', 'docker']) {
		await page.goto(`/#/settings/${path}`)
		await expect(page.locator('.settings-section').first()).toBeVisible()
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
			.toBe(true)
	}
})
test('file replacement can cross pages and deleting the final page retains pagination', async ({ page }) => {
	let deleted = false
	const files = Array.from({ length: 25 }, (_, index) => ({
		id: index + 1,
		ownerId: 1,
		src: '/favicon.svg',
		originalName: `audit-${index + 1}.png`,
		size: 100,
	}))
	await page.route('**/api/file/getList', (route) => {
		const { page: current } = route.request().postDataJSON()
		const list = deleted ? files.slice(0, 24) : files
		return route.fulfill({
			json: { code: 0, data: { count: list.length, list: list.slice((current - 1) * 24, current * 24) } },
		})
	})
	await page.route('**/api/file/usage', (route) => route.fulfill({ json: { code: 0, data: [] } }))
	let replacement: unknown
	await page.route('**/api/file/replace', (route) => {
		replacement = route.request().postDataJSON()
		return route.fulfill({ json: { code: 0 } })
	})
	await page.route('**/api/file/deletes', (route) => {
		deleted = true
		return route.fulfill({ json: { code: 0, data: { deletedIds: [25], failedIds: [] } } })
	})
	await enter(page, '/settings/files')
	await page.locator('.file-card').first().getByRole('button', { name: '正在使用此图片的位置' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.locator('.ant-pagination-item-2').click()
	await dialog.getByRole('combobox', { name: '选择替换图片' }).click()
	await page.getByText('audit-25.png', { exact: true }).click()
	await dialog.getByRole('button', { name: '替换我的引用', exact: true }).click()
	await expect.poll(() => replacement).toEqual({ id: 1, replacementId: 25 })
	await expect(dialog).toHaveCount(0)
	await page.locator('.ant-pagination-item-2').click()
	await expect(page.getByText('audit-25.png', { exact: true })).toBeVisible()
	await page.getByRole('button', { name: '删除', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page.getByText('audit-25.png', { exact: true })).toHaveCount(0)
	await page.locator('.ant-pagination-item-1').click()
	await expect(page.getByText('audit-1.png', { exact: true })).toBeVisible()
})
test('user creation and edit forms persist; password change revokes the user session', async ({
	page,
	request,
	browser,
}) => {
	await enter(page, '/settings/users')
	await page.getByRole('button', { name: '添加', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('账号', { exact: true }).fill('audit-password-user')
	await dialog.getByLabel('昵称', { exact: true }).fill('Audit User')
	await dialog.getByLabel('密码', { exact: true }).fill('auditPass123')
	await dialog.getByRole('button', { name: /确.*定/ }).click()
	const row = page.getByRole('row').filter({ hasText: 'audit-password-user' })
	await expect(row).toBeVisible()
	await row.getByRole('button', { name: '编辑', exact: true }).click()
	await dialog.getByLabel('昵称', { exact: true }).fill('Edited User')
	await dialog.getByRole('button', { name: /确.*定/ }).click()
	await expect(row).toContainText('Edited User')
	const user = await api(request, '/login', { username: 'audit-password-user', password: 'auditPass123' })
	const context = await browser.newContext()
	try {
		const accountPage = await context.newPage()
		await accountPage.addInitScript(
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
						},
					}),
				),
			user,
		)
		await accountPage.goto('http://127.0.0.1:16521/#/settings/account')
		await accountPage.getByLabel('旧密码', { exact: true }).fill('auditPass123')
		await accountPage.getByLabel('新密码', { exact: true }).fill('changedPass123')
		await accountPage.getByLabel('确认新密码', { exact: true }).fill('changedPass123')
		await accountPage.getByRole('button', { name: '修改密码', exact: true }).click()
		await expect(accountPage).toHaveURL(/login/)
		const rejected = await (
			await request.post('/api/user/updateInfo', {
				data: { name: 'Must not save' },
				headers: { token: user.token },
			})
		).json()
		expect(rejected.code).not.toBe(0)
		await api(request, '/login', { username: 'audit-password-user', password: 'changedPass123' })
	} finally {
		await context.close()
	}
	await row.getByRole('button', { name: '删除', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(row).toHaveCount(0)
})
test('home honors current-page, new-window, iframe and LAN navigation', async ({ page, request }) => {
	const groups = await api(request, '/panel/itemIconGroup/getList')
	const groupId = groups.list[0].id
	await api(request, '/panel/itemIcon/edit', {
		title: 'Audit navigation',
		url: '/favicon.svg?wan=1',
		lanUrl: '/favicon.svg?lan=1',
		openMethod: 2,
		itemIconGroupId: groupId,
		icon: { itemType: 1, text: 'A' },
	})
	const item = (
		await api(request, '/panel/itemIcon/getListByGroupId', { itemIconGroupId: groupId })
	).list.find((item: { title: string }) => item.title === 'Audit navigation')
	try {
		await enter(page, '/')
		const popupPromise = page.waitForEvent('popup')
		await page.getByRole('button', { name: 'Audit navigation', exact: true }).click()
		const popup = await popupPromise
		await expect(popup).toHaveURL(/favicon\.svg\?wan=1/)
		await popup.close()
		await api(request, '/panel/itemIcon/edit', { ...item, openMethod: 3 })
		await page.reload()
		await page.getByRole('button', { name: 'Audit navigation', exact: true }).click()
		await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', '/favicon.svg?wan=1')
		await expect(page.locator('iframe.app-frame')).not.toHaveAttribute('sandbox', /allow-same-origin/)
		await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
		await api(request, '/panel/itemIcon/edit', { ...item, openMethod: 1 })
		await page.reload()
		await page.getByRole('button', { name: '外网', exact: true }).click()
		await page.getByRole('button', { name: 'Audit navigation', exact: true }).click()
		await expect(page).toHaveURL(/favicon\.svg\?lan=1/)
	} finally {
		await api(request, '/panel/itemIcon/deletes', { ids: [item.id] })
	}
})
