import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

let admin: { token: string; id: number; name: string }
const ok = { code: 0, data: null }
function gate() {
	let release!: () => void
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	return { pending, release }
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
async function mockNavigation(page: Page) {
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: [
					{
						id: 991,
						title: 'Event group',
						items: [
							{
								id: 992,
								title: 'Event app',
								url: '/favicon.svg?event=wan',
								lanUrl: '/favicon.svg?event=lan',
								itemIconGroupId: 991,
								openMethod: 3,
								icon: { itemType: 2, src: '/favicon.svg' },
							},
							{
								id: 993,
								title: 'Second event app',
								url: '/favicon.svg',
								itemIconGroupId: 991,
								openMethod: 2,
								icon: null,
							},
						],
					},
					{ id: 994, title: 'Other event group', items: [] },
				],
			},
		}),
	)
}
test.beforeAll(async ({ request }) => {
	admin = (
		await (
			await request.post('/api/login', { data: { username: 'admin@zpanel.local', password: '12345678' } })
		).json()
	).data
})

test('leaving a page destroys its pending confirmation without sending the old action', async ({ page }) => {
	await mockNavigation(page)
	let deletes = 0
	await page.route('**/api/panel/itemIcon/deletes', (route) => {
		deletes++
		return route.fulfill({ json: ok })
	})
	await enter(page)
	await page.getByRole('link', { name: 'Event app', exact: true }).click({ button: 'right' })
	await page.getByRole('menuitem', { name: '删除', exact: true }).click()
	await expect(page.getByRole('dialog')).toBeVisible()
	await page.evaluate(() => {
		location.hash = '/settings/about'
	})
	await expect(page.getByRole('heading', { name: 'ZPanel', exact: true })).toBeVisible()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	expect(deletes).toBe(0)
})

test('login locks fields and sends only one request while pending', async ({ page }) => {
	const wait = gate()
	let attempts = 0
	await page.route('**/api/login', async (route) => {
		attempts++
		await wait.pending
		await route.fulfill({ json: { code: 1003 } })
	})
	await page.goto('/#/login')
	await page.getByLabel('账号', { exact: true }).fill('admin@zpanel.local')
	await page.getByLabel('密码', { exact: true }).fill('12345678')
	await page.getByRole('button', { name: '登录', exact: true }).click()
	try {
		await expect(page.getByLabel('账号', { exact: true })).toBeDisabled()
		await page.locator('form').evaluate((form: HTMLFormElement) => {
			form.requestSubmit()
			form.requestSubmit()
		})
		expect(attempts).toBe(1)
	} finally {
		wait.release()
	}
	await expect(page.getByLabel('账号', { exact: true })).toBeEnabled()
})

test('password drafts block navigation and cancellation preserves input', async ({ page }) => {
	await enter(page, '/settings/account')
	await page.getByLabel('旧密码', { exact: true }).fill('draft-password')
	await page.getByRole('menuitem', { name: '导航分组', exact: true }).click()
	await expect(page.getByRole('dialog')).toContainText('放弃未保存')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	await expect(page.getByLabel('旧密码', { exact: true })).toHaveValue('draft-password')
})

test('group editor cannot close or open another editor during save', async ({ page }) => {
	await mockNavigation(page)
	const wait = gate()
	await page.route('**/api/panel/itemIconGroup/edit', async (route) => {
		await wait.pending
		await route.fulfill({ json: ok })
	})
	await enter(page, '/settings/groups')
	await page.getByRole('button', { name: '添加', exact: true }).click()
	await page.getByLabel('标题').fill('Pending group')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	try {
		await expect(page.getByRole('dialog').getByRole('button', { name: /取.*消/ })).toBeDisabled()
		await page.keyboard.press('Escape')
		await expect(page.getByRole('dialog')).toBeVisible()
	} finally {
		wait.release()
	}
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

for (const scope of ['appearance', 'account', 'item'] as const) {
	test(`${scope} waits for image upload before allowing save`, async ({ page }) => {
		await mockNavigation(page)
		const wait = gate()
		await page.route('**/api/file/uploadImg', async (route) => {
			await wait.pending
			await route.fulfill({ json: { code: 0, data: { imageUrl: '/favicon.svg?uploaded=1', fileId: 999 } } })
		})
		await enter(page, scope === 'item' ? '/' : `/settings/${scope}`)
		if (scope === 'item') {
			await page.getByRole('link', { name: 'Event app', exact: true }).click({ button: 'right' })
			await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
		}
		await page
			.locator('input[type=file]')
			.setInputFiles({ name: 'event.png', mimeType: 'image/png', buffer: Buffer.from('test-image') })
		const save =
			scope === 'item'
				? page.getByRole('dialog').getByRole('button', { name: /确.*定/ })
				: page.getByRole('button', { name: '保存', exact: true })
		try {
			await expect(save).toBeDisabled()
		} finally {
			wait.release()
		}
		await expect(page.locator('.ant-upload-list-item-done')).toBeVisible()
		await expect(save).toBeEnabled()
	})
}

test('a late favicon response does not overwrite a manually changed icon', async ({ page }) => {
	await mockNavigation(page)
	const wait = gate()
	await page.route('**/api/panel/itemIcon/getSiteFavicon', async (route) => {
		await wait.pending
		await route.fulfill({ json: { code: 0, data: { iconUrl: '/favicon.svg?old=1' } } })
	})
	await enter(page)
	await page.getByRole('link', { name: 'Event app', exact: true }).click({ button: 'right' })
	await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
	await page.getByRole('button', { name: '获取图标', exact: true }).click()
	const icon = page.getByLabel('输入图标地址或上传', { exact: true })
	await icon.fill('/favicon.svg?manual=1')
	wait.release()
	await expect(page.getByRole('button', { name: '获取图标', exact: true })).not.toHaveClass(/loading/)
	await expect(icon).toHaveValue('/favicon.svg?manual=1')
})

test('deleting the last user on a page returns to the available page', async ({ page }) => {
	let deleted = false
	const users = Array.from({ length: 11 }, (_, i) => ({
		id: 900 + i,
		username: `event-user-${i}`,
		name: 'Event',
		role: 2,
	}))
	await page.route('**/api/panel/users/getList', (route) => {
		const { page: current } = route.request().postDataJSON()
		const list = deleted ? users.slice(0, 10) : users
		return route.fulfill({
			json: { code: 0, data: { count: list.length, list: list.slice((current - 1) * 10, current * 10) } },
		})
	})
	await page.route('**/api/panel/users/deletes', (route) => {
		deleted = true
		return route.fulfill({ json: ok })
	})
	await enter(page, '/settings/users')
	await page.locator('.ant-pagination-item-2').click()
	await page
		.getByRole('row')
		.filter({ hasText: 'event-user-10' })
		.getByRole('button', { name: '删除', exact: true })
		.click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page.getByRole('row').filter({ hasText: 'event-user-0' })).toBeVisible()
})

test('late anonymous login success is discarded after leaving login', async ({ page }) => {
	const wait = gate()
	await page.route('**/api/login', async (route) => {
		await wait.pending
		await route.fulfill({ json: { code: 0, data: admin } })
	})
	await page.goto('/#/login')
	await page.getByLabel('账号', { exact: true }).fill('admin@zpanel.local')
	await page.getByLabel('密码', { exact: true }).fill('12345678')
	await page.getByRole('button', { name: '登录', exact: true }).click()
	await page.evaluate(() => {
		location.hash = '/missing-event-page'
	})
	await expect(page.getByText('404', { exact: true })).toBeVisible()
	wait.release()
	await page.waitForTimeout(300)
	await expect(page).toHaveURL(/missing-event-page/)
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('zpanel-preferences') || '{}').state?.token),
	).toBeFalsy()
})

test('failed default-engine save rolls selection back so the same choice can be retried', async ({
	page,
}) => {
	const engines = ['Alpha', 'Beta'].map((title) => ({ title, url: `https://example.com/${title}?q=%s` }))
	let selected = engines[0]
	let attempts = 0
	await page.route('**/api/system/moduleConfig/getByName', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { searchEngineList: engines, currentSearchEngine: selected, newWindowOpen: true },
			},
		}),
	)
	await page.route('**/api/system/moduleConfig/save', (route) => {
		attempts++
		if (attempts === 1) return route.fulfill({ json: { code: 1200 } })
		selected = engines[1]
		return route.fulfill({ json: ok })
	})
	await enter(page)
	await page.getByRole('combobox', { name: '搜索引擎', exact: true }).click()
	await page.getByText('Beta', { exact: true }).click()
	await expect(page.locator('.search-box .ant-select')).toContainText('Alpha')
	await page.getByRole('combobox', { name: '搜索引擎', exact: true }).click()
	await page.getByText('Beta', { exact: true }).click()
	await expect.poll(() => attempts).toBe(2)
	await expect(page.locator('.search-box .ant-select')).toContainText('Beta')
})

test('LAN addresses participate in local search and IME Enter does not navigate', async ({ page }) => {
	await mockNavigation(page)
	await enter(page)
	const search = page.getByRole('textbox', { name: '搜索', exact: true })
	await search.fill('event=lan')
	await expect(page.getByRole('link', { name: 'Event app', exact: true })).toBeVisible()
	const popups: unknown[] = []
	page.on('popup', (popup) => {
		popups.push(popup)
		void popup.close()
	})
	await search.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
	expect(popups).toHaveLength(0)
})

test('detail card selection uses the accepted style value and survives saving', async ({ page }) => {
	await enter(page, '/settings/appearance')
	await page.getByRole('combobox', { name: '导航样式', exact: true }).click()
	await page.getByText('详情图标', { exact: true }).click()
	let payload: { panel: { iconStyle: number } } | undefined
	await page.route('**/api/panel/userConfig/set', async (route) => {
		payload = route.request().postDataJSON()
		await route.continue()
	})
	await page.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => payload?.panel.iconStyle).toBe(2)
	await page.getByRole('button', { name: '返回首页', exact: true }).click()
	await expect(page.locator('.home-hero')).toBeVisible()
	await expect(page.locator('.app-grid.icon-grid')).toHaveCount(0)
})

test('image replacement locks its target and cancel while pending', async ({ page }) => {
	const files = [1, 2].map((id) => ({
		id,
		ownerId: admin.id,
		src: '/favicon.svg',
		originalName: `event-${id}.png`,
		size: 1,
	}))
	await page.route('**/api/file/getList', (route) =>
		route.fulfill({ json: { code: 0, data: { count: 2, list: files } } }),
	)
	await page.route('**/api/file/usage', (route) => route.fulfill({ json: { code: 0, data: [] } }))
	const wait = gate()
	await page.route('**/api/file/replace', async (route) => {
		await wait.pending
		await route.fulfill({ json: ok })
	})
	await enter(page, '/settings/files')
	await page.locator('.file-card').first().getByRole('button', { name: '正在使用此图片的位置' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('combobox', { name: '选择替换图片' }).click()
	await page.locator('.ant-select-dropdown:visible').getByText('event-2.png', { exact: true }).click()
	await dialog.getByRole('button', { name: '替换我的引用', exact: true }).click()
	try {
		await expect(dialog.getByRole('combobox', { name: '选择替换图片' })).toBeDisabled()
		await page.keyboard.press('Escape')
		await expect(dialog).toBeVisible()
	} finally {
		wait.release()
	}
	await expect(dialog).toHaveCount(0)
})

test('the latest selected backup wins when file reads finish out of order', async ({ page }) => {
	await page.addInitScript(() => {
		const original = File.prototype.text
		File.prototype.text = async function () {
			if (this.name === 'slow.zpanel.json')
				await new Promise<void>((resolve) => {
					;(window as unknown as { releaseBackup: () => void }).releaseBackup = resolve
				})
			return original.call(this)
		}
	})
	const backup = {
		version: 1,
		appName: 'ZPanel-Config',
		exportTime: '',
		appVersion: '1.2.4',
		icons: [{ title: 'Event import', sort: 0, children: [] }],
	}
	const content = Buffer.from(
		JSON.stringify({ ...backup, md5: createHash('md5').update(JSON.stringify(backup)).digest('hex') }),
	)
	await enter(page, '/settings/backup')
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'slow.zpanel.json', mimeType: 'application/json', buffer: content })
	await expect
		.poll(() =>
			page.evaluate(() => typeof (window as unknown as { releaseBackup?: () => void }).releaseBackup),
		)
		.toBe('function')
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'latest.zpanel.json', mimeType: 'application/json', buffer: content })
	await expect(page.getByText('latest.zpanel.json', { exact: true })).toBeVisible()
	await page.evaluate(() => (window as unknown as { releaseBackup: () => void }).releaseBackup())
	await page.waitForTimeout(200)
	await expect(page.getByText('latest.zpanel.json', { exact: true })).toBeVisible()
	await expect(page.getByText('slow.zpanel.json', { exact: true })).toHaveCount(0)
})

test('brand navigation respects unsaved appearance changes', async ({ page }) => {
	await enter(page, '/settings/appearance')
	await page.getByLabel('面板名称').fill('Unsaved brand draft')
	await page.locator('.settings-sidebar .brand').click()
	await expect(page.getByRole('dialog')).toContainText('放弃未保存')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	await expect(page.getByLabel('面板名称')).toHaveValue('Unsaved brand draft')
})

test('closing the item editor restores focus to its action trigger', async ({ page }) => {
	await mockNavigation(page)
	await enter(page)
	const trigger = page.getByRole('link', { name: 'Event app', exact: true })
	await trigger.click({ button: 'right' })
	await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	await expect(trigger).toBeFocused()
})

test('reopening Docker logs reads fresh output and repeated actions have one confirmation', async ({
	page,
}) => {
	await page.route('**/api/system/docker/containers', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { count: 1, list: [{ id: 'event-container', names: 'Event container', state: 'exited' }] },
			},
		}),
	)
	await page.route('**/api/system/docker/stats', (route) => route.fulfill({ json: { code: 0, data: [] } }))
	let reads = 0
	await page.route('**/api/system/docker/logs', (route) => {
		reads++
		return route.fulfill({ json: { code: 0, data: { logs: `Event log ${reads}` } } })
	})
	await enter(page, '/settings/docker')
	await page.getByRole('button', { name: '日志', exact: true }).click()
	await expect(page.locator('.log-output')).toContainText('Event log 1')
	await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
	await page.getByRole('button', { name: '日志', exact: true }).click()
	await expect(page.locator('.log-output')).toContainText('Event log 2')
	await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click()
	await page.getByRole('button', { name: '启动', exact: true }).evaluate((button: HTMLButtonElement) => {
		button.click()
		button.click()
	})
	await expect(page.getByRole('dialog')).toHaveCount(1)
})

test('safe mode clears script effects even after the custom script has been emptied', async ({ page }) => {
	let customJs = 'document.documentElement.dataset.eventScript="active"'
	const config = () => ({
		loginCaptcha: false,
		siteSetting: { siteTitle: 'ZPanel', customJs, customCss: '' },
	})
	await page.route('**/api/openness/loginConfig', (route) =>
		route.fulfill({ json: { code: 0, data: config() } }),
	)
	await page.route('**/api/system/siteSetting/get', (route) =>
		route.fulfill({ json: { code: 0, data: config() } }),
	)
	await page.route('**/api/system/siteSetting/set', (route) => {
		customJs = route.request().postDataJSON().customJs
		return route.fulfill({ json: ok })
	})
	await enter(page, '/settings/site')
	await expect(page.locator('html')).toHaveAttribute('data-event-script', 'active')
	await page.getByLabel('JavaScript', { exact: true }).clear()
	await page.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => customJs).toBe('')
	await expect(page.getByLabel('JavaScript', { exact: true })).toBeEnabled()
	await page.evaluate(() => {
		location.hash = '/settings/site?safeMode=1'
	})
	await expect(page.getByLabel('JavaScript', { exact: true })).toBeVisible()
	await expect(page.locator('html')).not.toHaveAttribute('data-event-script')
})

test('a failed old language load cannot replace a newer selected language', async ({ page }) => {
	const wait = gate()
	await page.route('**/de-DE-*.js', async (route) => {
		await wait.pending
		await route.abort()
	})
	await enter(page, '/settings/account')
	await page.getByRole('combobox', { name: '界面语言', exact: true }).click()
	await page.getByText('Deutsch', { exact: true }).click()
	await page.getByRole('combobox', { name: '界面语言', exact: true }).click()
	for (let step = 0; step < 5; step++)
		await page.getByRole('combobox', { name: '界面语言', exact: true }).press('ArrowUp')
	await page.keyboard.press('Enter')
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('zpanel-preferences') || '{}').state.language),
		)
		.toBe('zh-CN')
	wait.release()
	await page.waitForTimeout(300)
	await expect(page.getByRole('heading', { name: '个人资料', exact: true })).toBeVisible()
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
})

test('saving an app into another group returns focus to its relocated link', async ({ page }) => {
	await mockNavigation(page)
	await enter(page)
	await page.getByRole('link', { name: 'Event app', exact: true }).click({ button: 'right' })
	await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
	await page.getByRole('combobox', { name: '分组', exact: true }).click()
	await page
		.locator('.ant-select-dropdown:visible .ant-select-item-option[title="Other event group"]')
		.click()
	await page.route('**/api/panel/itemIcon/edit', (route) => route.fulfill({ json: ok }))
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: [
					{ id: 991, title: 'Event group', items: [] },
					{
						id: 994,
						title: 'Other event group',
						items: [
							{
								id: 992,
								title: 'Event app',
								url: '/favicon.svg',
								openMethod: 3,
								itemIconGroupId: 994,
								icon: null,
							},
						],
					},
				],
			},
		}),
	)
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /确.*定/ })
		.click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Event app', exact: true })).toBeFocused()
})
