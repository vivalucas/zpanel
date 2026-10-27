import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

function gate() {
	let release!: () => void
	const waiting = new Promise<void>((resolve) => {
		release = resolve
	})
	return { waiting, release }
}

async function fixture(page: Page) {
	const state = {
		auth: { user: { id: 9400, role: 2 }, visitMode: 0 },
		authCode: 0,
		navigationCode: 0,
		title: 'Cached app',
		logoText: 'Cached home',
		authGate: undefined as ReturnType<typeof gate> | undefined,
		dataGate: undefined as ReturnType<typeof gate> | undefined,
		panelGate: undefined as ReturnType<typeof gate> | undefined,
		authReads: 0,
		panelReads: 0,
		navigationReads: 0,
	}
	await page.addInitScript(() => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'home-cache-fixture',
					accounts: [],
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
					homeEditHintDismissed: true,
				},
			}),
		)
	})
	await page.route('**/api/**', async (route) => {
		const path = new URL(route.request().url()).pathname
		let data: unknown = null
		let code = 0
		if (path === '/api/user/getAuthInfo') {
			state.authReads++
			await state.authGate?.waiting
			data = state.auth
			code = state.authCode
		}
		if (path === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		if (path === '/api/panel/userConfig/get') {
			state.panelReads++
			await state.dataGate?.waiting
			await state.panelGate?.waiting
			data = { panel: { logoText: state.logoText, footerHtml: '' } }
		}
		if (path === '/api/panel/itemIconGroup/getNavigation') {
			state.navigationReads++
			await state.dataGate?.waiting
			data = [
				{
					id: 9400,
					title: 'Cached group',
					items: [
						{
							id: 9401,
							title: state.title,
							url: '/favicon.svg',
							openMethod: 2,
							icon: { itemType: 1, text: 'C' },
						},
					],
				},
			]
			code = state.navigationCode
		}
		await route.fulfill({ json: { code, data, msg: 'Fixture response' } })
	})
	return state
}

async function seeded(page: Page) {
	const state = await fixture(page)
	await page.goto('/#/')
	await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toBeVisible()
	await expect
		.poll(() =>
			page.evaluate(() => !!JSON.parse(localStorage.getItem('zpanel-home-cache') || '{}').queries?.groups),
		)
		.toBe(true)
	return state
}

test('a reopened home waits for fresh authentication, then uses its snapshot while revalidating', async ({
	page,
}, info) => {
	const state = await seeded(page)
	state.authGate = gate()
	state.dataGate = gate()
	try {
		await page.reload()
		await expect(page.getByText('正在验证身份…', { exact: true })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toHaveCount(0)
		expect(state.panelReads).toBe(1)
		expect(state.navigationReads).toBe(1)
		state.authGate.release()
		const link = page.getByRole('link', { name: 'Cached app', exact: true })
		await expect(link).toBeVisible()
		await expect(link).toHaveAttribute('href', '/favicon.svg')
		await expect.poll(() => state.panelReads).toBe(2)
		await expect.poll(() => state.navigationReads).toBe(2)
		await expect(page.locator('.loading-state')).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Cached group 添加项目', exact: true })).toBeDisabled()
		await link.click({ button: 'right' })
		await expect(page.getByRole('menu')).toBeVisible()
		await expect(page.getByRole('menuitem', { name: '编辑', exact: true })).toHaveCount(0)
		await page.keyboard.press('Escape')
		await page.getByRole('textbox', { name: '搜索', exact: true }).fill('Cached')
		await expect(link).toBeVisible()
		await page.screenshot({ path: info.outputPath('cached-home-pending.png'), animations: 'disabled' })
		state.title = 'Updated app'
		await page.getByRole('textbox', { name: '搜索', exact: true }).clear()
		state.dataGate.release()
		await expect(page.getByRole('link', { name: 'Updated app', exact: true })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Cached group 添加项目', exact: true })).toBeEnabled()
		await expect(link).toHaveCount(0)
		expect(state.authReads).toBe(2)
	} finally {
		state.authGate.release()
		state.dataGate.release()
	}
})

test('a new tab in the same browser reuses the authenticated home snapshot', async ({ page, context }) => {
	await seeded(page)
	const other = await context.newPage()
	const state = await fixture(other)
	state.dataGate = gate()
	try {
		await other.goto('/#/')
		await expect(other.getByRole('link', { name: 'Cached app', exact: true })).toBeVisible()
		await expect.poll(() => state.navigationReads).toBe(1)
		await expect(other.locator('.loading-state')).toHaveCount(0)
	} finally {
		state.dataGate.release()
		await other.close()
	}
})

test('an unchanged background response unlocks cached editing and search controls', async ({ page }) => {
	const state = await seeded(page)
	state.dataGate = gate()
	try {
		await page.reload()
		await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toBeVisible()
		const add = page.getByRole('button', { name: 'Cached group 添加项目', exact: true })
		await expect(add).toBeDisabled()
		state.dataGate.release()
		await expect(add).toBeEnabled()
		await expect(page.getByRole('combobox', { name: '搜索引擎', exact: true })).toBeEnabled()
		await add.click()
		await expect(page.getByRole('dialog').getByLabel('标题', { exact: true })).toBeVisible()
		await page.getByRole('button', { name: '取消', exact: true }).click()
	} finally {
		state.dataGate.release()
	}
})

for (const entry of ['direct', 'from-home'] as const) {
	test(`settings entered ${entry} wait for current values before exposing an editable form`, async ({
		page,
	}) => {
		const state = await seeded(page)
		state.logoText = 'Current server home'
		state.dataGate = gate()
		try {
			if (entry === 'direct') await page.goto('/?entry=direct#/settings/appearance')
			else {
				await page.reload()
				await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toBeVisible()
				await page.getByRole('button', { name: '设置', exact: true }).click()
			}
			await expect(page.locator('.settings-window')).toBeVisible()
			await expect(page.getByLabel('面板名称', { exact: true })).toHaveCount(0)
			await expect(page.locator('.settings-body .loading-state')).toBeVisible()
			state.dataGate.release()
			await expect(page.getByLabel('面板名称', { exact: true })).toHaveValue('Current server home')
		} finally {
			state.dataGate.release()
		}
	})
}

for (const scope of ['account', 'role', 'public'] as const) {
	test(`a ${scope} change cannot display the previous private snapshot`, async ({ page }) => {
		const state = await seeded(page)
		if (scope === 'account') state.auth.user.id = 9402
		if (scope === 'role') state.auth.user.role = 1
		if (scope === 'public') state.auth.visitMode = 1
		state.dataGate = gate()
		try {
			await page.reload()
			await expect.poll(() => state.panelReads).toBeGreaterThan(1)
			await expect(page.getByText('正在加载页面…', { exact: true })).toBeVisible()
			await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toHaveCount(0)
		} finally {
			state.dataGate.release()
		}
	})
}

test('an authentication denial removes the persisted private snapshot', async ({ page }) => {
	const state = await seeded(page)
	state.authCode = 1005
	await page.reload()
	await expect(page.getByText('当前无权限操作', { exact: true })).toBeVisible()
	await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toHaveCount(0)
	expect(await page.evaluate(() => localStorage.getItem('zpanel-home-cache'))).toBeNull()
	state.authCode = 0
	state.dataGate = gate()
	try {
		await page.getByRole('button', { name: '重试', exact: true }).click()
		await expect(page.getByText('正在加载页面…', { exact: true })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toHaveCount(0)
		state.dataGate.release()
		await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toBeVisible()
	} finally {
		state.dataGate.release()
	}
})

test('a background failure keeps cached navigation usable, while permission denial hides and evicts it', async ({
	page,
}) => {
	const state = await seeded(page)
	state.navigationCode = 500
	await page.reload()
	const link = page.getByRole('link', { name: 'Cached app', exact: true })
	await expect(page.getByText('刷新失败，仍显示上次数据', { exact: true })).toBeVisible()
	await expect(link).toBeVisible()
	state.navigationCode = 1005
	await page.getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.getByText('当前无权限操作', { exact: true })).toBeVisible()
	await expect(link).toHaveCount(0)
	expect(
		await page.evaluate(() => JSON.parse(localStorage.getItem('zpanel-home-cache') || '{}').queries?.groups),
	).toBeUndefined()
	state.navigationCode = 0
	state.title = 'Recovered app'
	await page.getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.getByRole('link', { name: 'Recovered app', exact: true })).toBeVisible()
})

for (const phase of ['authentication', 'panel'] as const) {
	test(`a stalled ${phase} read times out with a retry that can recover`, async ({ page }) => {
		await page.clock.install()
		const state = await fixture(page)
		const pending = gate()
		if (phase === 'authentication') state.authGate = pending
		else state.panelGate = pending
		try {
			await page.goto('/#/')
			await expect(
				page.getByText(phase === 'authentication' ? '正在验证身份…' : '正在加载页面…', { exact: true }),
			).toBeVisible()
			await page.clock.fastForward(15_001)
			await expect(page.getByText('网络响应超时，请检查连接后重试。', { exact: true })).toBeVisible()
			pending.release()
			await page.getByRole('button', { name: '重试', exact: true }).click()
			await expect(page.getByRole('link', { name: 'Cached app', exact: true })).toBeVisible()
		} finally {
			pending.release()
		}
	})
}
