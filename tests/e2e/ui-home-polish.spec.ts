import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const app = {
	id: 8702,
	title: 'Polish app',
	url: '/favicon.svg',
	itemIconGroupId: 8701,
	openMethod: 3,
	icon: { itemType: 2, src: '/favicon.svg' },
}
const engines = [
	{ title: 'Alpha', url: 'https://example.com/?q=%s', iconSrc: '/favicon.svg?alpha' },
	{ title: 'Beta', url: 'https://example.com/?q=%s', iconSrc: '/favicon.svg?beta' },
]

async function fixture(page: Page, monitors = false) {
	const state = {
		navigationError: 0,
		panelError: 0,
		monitorError: 0,
		monitorConfigError: 0,
		selected: engines[1],
	}
	await page.clock.install()
	await page.addInitScript(() => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'ui-home-polish',
					accounts: [],
					language: 'zh-CN',
					theme: 'light',
					network: 'wan',
					homeEditHintDismissed: true,
				},
			}),
		)
	})
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { user: { id: 8700, role: 2 }, visitMode: 0 },
			},
		}),
	)
	await page.route('**/api/openness/loginConfig', (route) =>
		route.fulfill({ json: { code: 0, data: { loginCaptcha: false, siteSetting: {} } } }),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: state.panelError
				? { code: state.panelError, msg: 'Simulated panel failure' }
				: {
						code: 0,
						data: {
							panel: { logoText: 'Polish home', marginTop: 2, systemMonitorShow: monitors },
							panelWarnings: [],
						},
					},
		}),
	)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: state.navigationError
				? { code: state.navigationError, msg: 'Simulated navigation failure' }
				: { code: 0, data: [{ id: 8701, title: 'Polish group', items: [app] }] },
		}),
	)
	await page.route('**/api/system/moduleConfig/getByName', (route) => {
		const monitor = route.request().postDataJSON().name === 'module-systemMonitor'
		return route.fulfill({
			json:
				monitor && state.monitorConfigError
					? { code: state.monitorConfigError, msg: 'Simulated monitor configuration failure' }
					: {
							code: 0,
							data: monitor
								? { list: [{ key: 'polish-cpu', monitorType: 'cpu' }] }
								: { searchEngineList: engines, currentSearchEngine: state.selected, newWindowOpen: true },
						},
		})
	})
	await page.route('**/api/system/monitor/getCpuState', (route) =>
		route.fulfill({
			json: state.monitorError
				? { code: state.monitorError, msg: 'Simulated metric failure' }
				: { code: 0, data: { usages: [25], coreCount: 4 } },
		}),
	)
	await page.goto('/#/')
	await expect(page.getByRole('link', { name: app.title, exact: true })).toBeVisible()
	return state
}

async function revisitHome(page: Page) {
	await page.clock.fastForward(31_000)
	await page.getByRole('button', { name: '设置', exact: true }).click()
	await expect(page.getByRole('button', { name: '返回首页', exact: true })).toBeVisible()
	await page.getByRole('button', { name: '返回首页', exact: true }).click()
}

async function edit(page: Page) {
	await page.getByRole('button', { name: `更多操作 ${app.title}`, exact: true }).click()
	await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
	await expect(page.getByLabel('标题', { exact: true })).toBeVisible()
}

for (const source of ['navigationError', 'panelError'] as const) {
	test(`home keeps cached navigation and controls after ${source} refresh failure`, async ({
		page,
	}, info) => {
		const state = await fixture(page)
		state[source] = 500
		await revisitHome(page)
		await expect(page.getByRole('alert')).toContainText('刷新失败，仍显示上次数据')
		await expect(page.getByRole('link', { name: app.title, exact: true })).toBeVisible()
		await expect(page.getByRole('button', { name: '设置', exact: true })).toBeVisible()
		await page.screenshot({ path: info.outputPath(`cached-home-${source}.png`), animations: 'disabled' })
		state[source] = 0
		await page.getByRole('button', { name: '重试', exact: true }).click()
		await expect(page.getByRole('alert')).toHaveCount(0)
	})
}

test('permission failure hides cached navigation instead of treating it as stale data', async ({ page }) => {
	const state = await fixture(page)
	state.navigationError = 403
	await revisitHome(page)
	await expect(page.locator('.error-page')).toBeVisible()
	await expect(page.getByRole('link', { name: app.title, exact: true })).toHaveCount(0)
})

test('monitor refresh failures retain the last value and configuration but permission failures hide it', async ({
	page,
}) => {
	const state = await fixture(page, true)
	const card = page.locator('.monitor-card')
	await expect(card).toContainText('25.0')
	state.monitorError = 500
	await page.clock.fastForward(5_000)
	await expect(card.getByRole('status')).toContainText('刷新失败，仍显示上次数据')
	await expect(card).toContainText('25.0')
	state.monitorError = 0
	state.monitorConfigError = 500
	await revisitHome(page)
	await expect(page.locator('.monitor-section').getByRole('alert')).toContainText('刷新失败，仍显示上次数据')
	await expect(card).toContainText('25.0')
	state.monitorError = 403
	await page.clock.fastForward(5_000)
	await expect(card).toContainText('暂时不可用')
	await expect(card).not.toContainText('25.0')
	state.monitorConfigError = 1005
	await revisitHome(page)
	await expect(page.locator('.monitor-card')).toHaveCount(0)
	await expect(page.getByRole('link', { name: app.title, exact: true })).toBeVisible()
})

test('clicking the same more button twice closes the menu', async ({ page }, info) => {
	await fixture(page)
	const more = page.getByRole('button', { name: `更多操作 ${app.title}`, exact: true })
	await more.click()
	await expect(page.getByRole('menu', { name: `更多操作 ${app.title}`, exact: true })).toBeVisible()
	await page.screenshot({ path: info.outputPath('glass-app-menu.png'), animations: 'disabled' })
	await more.click()
	await expect(page.getByRole('menu', { name: `更多操作 ${app.title}`, exact: true })).toHaveCount(0)
	await expect(more).toBeFocused()
})

test('opening a right-clicked app closes its menu for embedded and native link actions', async ({ page }) => {
	await fixture(page)
	const link = page.getByRole('link', { name: app.title, exact: true })
	const menu = page.getByRole('menu', { name: `更多操作 ${app.title}`, exact: true })
	const rightClick = async () => {
		// Keep the link's centre outside the pointer-positioned popup for the next click.
		await link.click({ button: 'right', position: { x: 10, y: 60 } })
		await expect(menu).toBeVisible()
	}
	await rightClick()
	await link.click()
	await expect(page.locator('iframe.app-frame')).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.locator('iframe.app-frame')).toHaveCount(0)
	await expect(menu).toHaveCount(0)
	for (const options of [
		{ modifiers: ['ControlOrMeta'] as 'ControlOrMeta'[] },
		{ button: 'middle' as const },
	]) {
		await rightClick()
		const opened = page.context().waitForEvent('page')
		await link.click(options)
		const popup = await opened
		await expect(popup).toHaveURL(/favicon.svg/)
		await popup.close()
		await expect(menu).toHaveCount(0)
	}
})

for (const change of ['address', 'type'] as const) {
	test(`late item upload keeps the newer ${change} draft`, async ({ page }) => {
		await fixture(page)
		let release!: () => void
		let responseHandled = false
		const pending = new Promise<void>((resolve) => {
			release = resolve
		})
		await page.route('**/api/file/uploadImg', async (route) => {
			await pending
			await route
				.fulfill({ json: { code: 0, data: { imageUrl: '/favicon.svg?late-upload', fileId: 8709 } } })
				.catch(() => {})
			responseHandled = true
		})
		await edit(page)
		await page
			.locator('input[type=file]')
			.setInputFiles({ name: 'polish.png', mimeType: 'image/png', buffer: Buffer.from('fixture') })
		await expect(page.getByRole('dialog').getByRole('button', { name: '确定', exact: true })).toBeDisabled()
		const icon = page.getByLabel('输入图标地址或上传', { exact: true })
		try {
			if (change === 'address') await icon.fill('/favicon.svg?manual-newer')
			else {
				await page.getByLabel('图标类型', { exact: true }).click()
				await page.locator('.ant-select-dropdown').getByText('文字图标', { exact: true }).click()
				await page.getByLabel('图标类型', { exact: true }).click()
				await page.locator('.ant-select-dropdown').getByText('图片图标', { exact: true }).click()
			}
		} finally {
			release()
		}
		await expect.poll(() => responseHandled).toBe(true)
		if (change === 'address') await expect(page.locator('.ant-upload-list-item-done')).toBeVisible()
		await expect(icon).toHaveValue(change === 'address' ? '/favicon.svg?manual-newer' : '/favicon.svg')
	})
}

test('single image uploads serialize failed retries with a newly selected file', async ({ page }) => {
	await fixture(page)
	const pending: (() => void)[] = []
	let uploads = 0
	await page.route('**/api/file/uploadImg', async (route) => {
		const sequence = ++uploads
		if (sequence === 1)
			return route.fulfill({ json: { code: 500, msg: 'Initial upload failed' } })
		await new Promise<void>((resolve) => pending.push(resolve))
		await route
			.fulfill({
				json: {
					code: 0,
					data: { imageUrl: `/favicon.svg?upload-${sequence}`, fileId: 8709 + sequence },
				},
			})
			.catch(() => {})
	})
	await edit(page)
	const upload = page.getByRole('dialog').getByRole('button', { name: '本地上传', exact: true })
	const retry = page.getByRole('dialog').getByRole('button', { name: '重试', exact: true })
	const save = page.getByRole('dialog').getByRole('button', { name: '确定', exact: true })
	const icon = page.getByLabel('输入图标地址或上传', { exact: true })
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'failed.png', mimeType: 'image/png', buffer: Buffer.from('fixture') })
	await expect(retry).toBeEnabled()
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'newer.png', mimeType: 'image/png', buffer: Buffer.from('fixture') })
	try {
		await expect.poll(() => pending.length).toBe(1)
		await expect(retry).toBeDisabled()
		await expect(upload).toBeDisabled()
		await expect(save).toBeDisabled()
		expect(uploads).toBe(2)
	} finally {
		pending.shift()?.()
	}
	await expect(icon).toHaveValue('/favicon.svg?upload-2')
	await expect(retry).toBeEnabled()
	await retry.click()
	try {
		await expect.poll(() => pending.length).toBe(1)
		await expect(upload).toBeDisabled()
		await expect(save).toBeDisabled()
		expect(uploads).toBe(3)
	} finally {
		pending.shift()?.()
	}
	await expect(icon).toHaveValue('/favicon.svg?upload-3')
	await expect(save).toBeEnabled()
})

test('item draft close requires confirmation and a small viewport keeps actions visible', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 390, height: 640 })
	await fixture(page)
	await edit(page)
	await page.getByLabel('标题', { exact: true }).fill('New unsaved title')
	await page.keyboard.press('Escape')
	const confirm = page.locator('.ant-modal-confirm')
	await expect(confirm).toContainText('放弃未保存的修改并离开？')
	await confirm.getByRole('button', { name: '取消', exact: true }).click()
	await expect(confirm).toHaveCount(0)
	await expect(page.getByLabel('标题', { exact: true })).toHaveValue('New unsaved title')
	const footer = await page.locator('.item-editor-footer').boundingBox()
	expect(footer!.y).toBeGreaterThanOrEqual(0)
	expect(footer!.y + footer!.height).toBeLessThanOrEqual(640)
	expect(
		await page
			.locator('.item-editor-body')
			.evaluate((element) => element.scrollHeight > element.clientHeight),
	).toBe(true)
	await page.screenshot({ path: info.outputPath('item-editor-mobile.png'), animations: 'disabled' })
	await page.mouse.click(5, 5)
	await expect(confirm).toContainText('放弃未保存的修改并离开？')
	await confirm.getByRole('button', { name: '确定', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('home selects and saves the complete engine when URLs are duplicated', async ({ page }) => {
	const state = await fixture(page)
	const saved: string[] = []
	await page.route('**/api/system/moduleConfig/save', (route) => {
		state.selected = route.request().postDataJSON().value.currentSearchEngine
		saved.push(state.selected.title)
		return route.fulfill({ json: { code: 0, data: null } })
	})
	await expect(page.locator('.search-box .ant-select')).toContainText('Beta')
	for (const title of ['Alpha', 'Beta']) {
		await page.getByRole('combobox', { name: '搜索引擎', exact: true }).click()
		await page.locator('.ant-select-dropdown').getByText(title, { exact: true }).click()
		await expect.poll(() => saved.at(-1)).toBe(title)
		await expect(page.locator('.search-box .ant-select')).toContainText(title)
	}
	expect(saved).toEqual(['Alpha', 'Beta'])
})
