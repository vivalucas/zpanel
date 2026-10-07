import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

let admin: { token: string; id: number }
async function api(request: APIRequestContext, path: string, data: unknown = {}, token = admin.token) {
	const result = await (await request.post(`/api${path}`, { data, headers: { token } })).json()
	expect(result.code, `${path}: ${result.msg}`).toBe(0)
	return result.data
}
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
	admin = await api(request, '/login', { username: 'admin@zpanel.local', password: '12345678' }, '')
	await api(request, '/panel/itemIconGroup/getNavigation')
	const cfg = await (
		await request.post('/api/panel/userConfig/get', { data: {}, headers: { token: admin.token } })
	).json()
	if (cfg.code === 1202) await api(request, '/panel/userConfig/set', { panel: {} })
})

test('ordinary users cannot create administrators through group associations; long passwords work', async ({
	request,
}) => {
	const password = 'p'.repeat(72)
	const user = await api(request, '/panel/users/create', {
		username: 'review-ordinary',
		password,
		name: 'Review',
		role: 2,
		status: 1,
	})
	const ordinary = await api(request, '/login', { username: 'review-ordinary', password }, '')
	const group = await api(
		request,
		'/panel/itemIconGroup/edit',
		{
			title: 'Review own',
			userId: admin.id,
			user: { username: 'review-injected', password: 'hash', role: 1, status: 1 },
		},
		ordinary.token,
	)
	expect(group.userId).toBe(ordinary.id)
	const users = await api(request, '/panel/users/getList')
	expect(users.list.some((entry: { username: string }) => entry.username === 'review-injected')).toBe(false)
	const denied = await (
		await request.post('/api/panel/users/getList', { headers: { token: ordinary.token }, data: {} })
	).json()
	expect(denied.code).toBe(1005)
	await api(request, '/panel/users/deletes', { userIds: [user.id] })
})

test('public monitor flags are enforced by the server and public-user responses are minimal', async ({
	request,
}) => {
	const cfg = await api(request, '/panel/userConfig/get')
	const previous = await (
		await request.post('/api/panel/users/getPublicVisitUser', { headers: { token: admin.token }, data: {} })
	).json()
	try {
		await api(request, '/panel/users/setPublicVisitUser', { userId: admin.id })
		await api(request, '/panel/userConfig/set', {
			panel: { ...cfg.panel, systemMonitorShow: true, systemMonitorPublicVisitModeShow: false },
		})
		const denied = await (await request.post('/api/system/monitor/getMemonyState', { data: {} })).json()
		expect(denied.code).toBe(1005)
		const publicUser = await api(request, '/panel/users/getPublicVisitUser')
		expect(Object.keys(publicUser).sort()).toEqual(['id', 'name', 'username'])
		await api(request, '/panel/userConfig/set', {
			panel: { ...cfg.panel, systemMonitorShow: true, systemMonitorPublicVisitModeShow: true },
		})
		const allowed = await (await request.post('/api/system/monitor/getMemonyState', { data: {} })).json()
		expect(allowed.code).toBe(0)
	} finally {
		await api(request, '/panel/userConfig/set', cfg)
		await api(request, '/panel/users/setPublicVisitUser', {
			userId: previous.code === 0 ? previous.data.id : null,
		})
	}
})

test('invalid style writes fail and legacy values show a repair path without crashing', async ({
	page,
	request,
}) => {
	const invalid = await (
		await request.post('/api/panel/userConfig/import', {
			headers: { token: admin.token },
			data: { requestId: 'review-invalid-style-123', mode: 'append', panel: { iconTextColor: 42 } },
		})
	).json()
	expect(invalid.code).not.toBe(0)
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	await page.route('**/api/panel/userConfig/get', async (route) => {
		const response = await route.fetch()
		const json = await response.json()
		json.data.panel.iconTextColor = 42
		await route.fulfill({ json })
	})
	await enter(page)
	await expect(page.getByRole('button', { name: '修复外观配置' })).toBeVisible()
	await page.getByRole('button', { name: '修复外观配置' }).click()
	await expect(
		page.getByText('部分外观配置不合法，已临时使用默认值。检查后点击保存即可修复，应用导航不受影响。'),
	).toBeVisible()
	expect(errors).toEqual([])
})

test('LAN-only entry, native links, and moving applications before deleting a group', async ({
	page,
	request,
}) => {
	const group = await api(request, '/panel/itemIconGroup/edit', { title: 'Review LAN' })
	const destination = await api(request, '/panel/itemIconGroup/edit', { title: 'Review destination' })
	try {
		await enter(page)
		const section = page
			.locator('.navigation-group')
			.filter({ has: page.getByRole('heading', { name: 'Review LAN', exact: true }) })
		await section.getByRole('button', { name: '添加第一个应用' }).click()
		await page.getByLabel('标题', { exact: true }).fill('Review LAN-only app')
		await page.getByLabel('内网地址', { exact: true }).fill('/favicon.svg?review-lan=1')
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /确.*定/ })
			.click()
		const link = page.getByRole('link', { name: 'Review LAN-only app', exact: true })
		await expect(link).toHaveAttribute('href', '/favicon.svg?review-lan=1')
		const popup = page.context().waitForEvent('page', { timeout: 5000 })
		await link.click({ button: 'middle' })
		await (await popup).close()
		await page.goto('/#/settings/groups')
		await page
			.locator('.group-row')
			.filter({ hasText: 'Review LAN' })
			.getByRole('button', { name: '删除' })
			.click()
		await expect(page.getByText('分组「Review LAN」包含 1 个应用。')).toBeVisible()
		await page.getByRole('combobox', { name: '分组内应用的处理方式' }).click()
		await page.getByText('将应用移至「Review destination」', { exact: true }).click()
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /确.*定/ })
			.click()
		await expect(page.locator('.group-row').filter({ hasText: 'Review LAN' })).toHaveCount(0)
		const snapshot = await api(request, '/panel/itemIconGroup/getNavigation')
		expect(snapshot.find((entry: { id: number }) => entry.id === destination.id).items[0].title).toBe(
			'Review LAN-only app',
		)
	} finally {
		await api(request, '/panel/itemIconGroup/deletes', { ids: [group.id, destination.id] })
	}
})

test('upload failure can be retried and successful files remain visible', async ({ page }) => {
	let attempts = 0
	await page.route('**/api/file/uploadImg', async (route) => {
		attempts++
		await route.fulfill({
			json: attempts === 1 ? { code: 1300 } : { code: 0, data: { imageUrl: '/favicon.svg', fileId: 999 } },
		})
	})
	await enter(page, '/settings/files')
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'review.png', mimeType: 'image/png', buffer: Buffer.from('test image') })
	await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
	await page.getByRole('button', { name: '重试' }).click()
	await expect(page.locator('.ant-upload-list-item-done')).toContainText('review.png')
	expect(attempts).toBe(2)
})
