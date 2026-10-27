import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

async function fixture(
	page: Page,
	write?: (route: Route, index: number) => Promise<void>,
	language = 'zh-CN',
) {
	const panel: Record<string, unknown> = {
		logoText: 'Original',
		backgroundBlur: 7,
		backgroundMaskNumber: 0.15,
	}
	const writes: Record<string, unknown>[] = []
	await page.addInitScript(
		(language) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: { token: 'auto-save-fixture', theme: 'light', language, accounts: [] },
				}),
			),
		language,
	)
	await page.route('**/api/**', async (route) => {
		const path = new URL(route.request().url()).pathname
		let data: unknown = null
		if (path === '/api/user/getAuthInfo') data = { user: { id: 2701, name: 'Tester', role: 1 }, visitMode: 0 }
		if (path === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		if (path === '/api/panel/userConfig/get') data = { panel, panelWarnings: [] }
		if (path === '/api/panel/userConfig/set') {
			const value = route.request().postDataJSON().panel
			writes.push(structuredClone(value))
			if (write) return write(route, writes.length)
			Object.assign(panel, value)
		}
		return route.fulfill({ json: { code: 0, data } })
	})
	await page.goto('/#/settings/appearance')
	await expect(page.locator('#logoText')).toHaveValue('Original')
	return writes
}

test('opening settings preserves legacy values and both sliders use integer levels from 0 to 10', async ({
	page,
}) => {
	const writes = await fixture(page)
	await page.locator('#logoText').press('Enter')
	await page.waitForTimeout(700)
	expect(writes).toHaveLength(0)
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'idle')
	await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0)
	const blur = page.getByRole('slider', { name: '壁纸模糊', exact: true })
	const shade = page.getByRole('slider', { name: '壁纸暗度', exact: true })
	for (const slider of [blur, shade]) {
		await expect(slider).toHaveAttribute('aria-valuemin', '0')
		await expect(slider).toHaveAttribute('aria-valuemax', '10')
	}
	await page.getByLabel('面板名称').fill('New title')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes[0]).toMatchObject({ backgroundBlur: 7, backgroundMaskNumber: 0.15 })
	await blur.press('End')
	await shade.press('End')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)).toMatchObject({ backgroundBlur: 30, backgroundMaskNumber: 1 })
	await blur.press('Home')
	await shade.press('Home')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)).toMatchObject({ backgroundBlur: 0, backgroundMaskNumber: 0 })
	await expect(page.locator('.ant-message-notice')).toHaveCount(1)
	await expect(page.locator('.ant-message-notice')).toHaveText('已保存')
})

for (const firstFails of [false, true]) {
	test(`edits during a pending save are serialized and survive the old ${firstFails ? 'failure' : 'success'}`, async ({
		page,
	}) => {
		let release!: () => void
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const writes = await fixture(page, async (route, index) => {
			if (index === 1) await gate
			return route.fulfill({ json: { code: index === 1 && firstFails ? 1200 : 0 } })
		})
		const name = page.getByLabel('面板名称')
		await name.fill('First draft')
		await expect.poll(() => writes.length).toBe(1)
		try {
			await expect(name).toBeEnabled()
			await name.fill('Intermediate draft')
			await name.fill('Latest draft')
			await page.waitForTimeout(750)
			expect(writes).toHaveLength(1)
			await expect(name).toHaveValue('Latest draft')
		} finally {
			release()
		}
		await expect.poll(() => writes.length).toBe(2)
		await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
		expect(writes.map((value) => value.logoText)).toEqual(['First draft', 'Latest draft'])
		await expect(name).toHaveValue('Latest draft')
	})
}

test('failed saves retain the draft and retry only after an explicit retry or a new edit', async ({
	page,
}) => {
	const writes = await fixture(page, async (route, index) =>
		route.fulfill({ json: { code: index === 1 ? 1200 : 0 } }),
	)
	const name = page.getByLabel('面板名称')
	await name.fill('Keep this draft')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'error')
	await page.waitForTimeout(1000)
	expect(writes).toHaveLength(1)
	await expect(name).toHaveValue('Keep this draft')
	await page.locator('.auto-save-status').getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	await expect(page.locator('.ant-message-notice')).toHaveCount(1)
	await expect(page.locator('.ant-message-notice')).toHaveText('已保存')
	expect(writes).toHaveLength(2)
	await name.fill('x'.repeat(201))
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'invalid')
	expect(writes).toHaveLength(2)
	await name.fill('Valid again')
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	expect(writes.at(-1)?.logoText).toBe('Valid again')
})

for (const failedModule of ['search', 'monitor'] as const) {
	test(`module feedback keeps the ${failedModule} failure until every draft recovers`, async ({ page }) => {
		await page.clock.install()
		await fixture(page)
		const failedName = failedModule === 'search' ? 'module-deskModuleSearchBox' : 'module-systemMonitor'
		const writes: { name: string; value: unknown }[] = []
		let fail = true
		let release!: () => void
		const successfulSave = new Promise<void>((resolve) => {
			release = resolve
		})
		await page.route('**/api/system/moduleConfig/getByName', (route) => {
			const engine = { title: 'Original engine', url: 'https://example.com/?q=%s', iconSrc: '' }
			return route.fulfill({
				json: {
					code: 0,
					data:
						route.request().postDataJSON().name === 'module-deskModuleSearchBox'
							? { searchEngineList: [engine], currentSearchEngine: engine, newWindowOpen: true }
							: { list: [{ key: 'feedback-cpu', monitorType: 'cpu', description: 'Original monitor' }] },
				},
			})
		})
		await page.route('**/api/system/monitor/getDiskMountpoints', (route) =>
			route.fulfill({ json: { code: 0, data: [] } }),
		)
		await page.route('**/api/system/moduleConfig/save', async (route) => {
			const body = route.request().postDataJSON()
			writes.push(body)
			if (body.name === failedName) return route.fulfill({ json: { code: fail ? 1200 : 0 } })
			await successfulSave
			return route.fulfill({ json: { code: 0 } })
		})
		await page.getByRole('menuitem', { name: '搜索与监控', exact: true }).click()
		const failedSection = page.locator('.settings-section').nth(failedModule === 'search' ? 0 : 1)
		const successfulSection = page.locator('.settings-section').nth(failedModule === 'search' ? 1 : 0)
		const failedStatus = failedSection.locator('.auto-save-status')
		const successfulStatus = successfulSection.locator('.auto-save-status')
		const successfulField = page.locator(
			failedModule === 'search' ? '#list_0_description' : '#searchEngineList_0_title',
		)
		await page.locator('#searchEngineList_0_title').fill('Search draft')
		await page.locator('#list_0_description').fill('Monitor draft')
		const toast = page.locator('.ant-message-notice')
		try {
			await expect(failedStatus).toHaveAttribute('data-save-status', 'error')
			await expect(successfulStatus).toHaveAttribute('data-save-status', 'saving')
			await expect(toast).toHaveCount(1)
			await expect(toast).toHaveText('数据库出错')
		} finally {
			release()
		}
		await expect(successfulStatus).toHaveAttribute('data-save-status', 'saved')
		await expect(failedStatus).toHaveAttribute('data-save-status', 'error')
		await expect(toast).toHaveCount(1)
		await expect(toast).toHaveText('数据库出错')
		// An unresolved failure must outlast the normal success notification duration.
		await page.clock.fastForward(4_000)
		await expect(toast).toHaveText('数据库出错')
		await successfulField.fill('Another successful draft')
		await expect.poll(() => writes.length).toBe(3)
		await expect(successfulStatus).toHaveAttribute('data-save-status', 'saved')
		await expect(toast).toHaveCount(1)
		await expect(toast).toHaveText('数据库出错')
		fail = false
		await failedStatus.getByRole('button', { name: '重试', exact: true }).click()
		await expect.poll(() => writes.length).toBe(4)
		await expect(failedStatus).toHaveAttribute('data-save-status', 'saved')
		await expect(toast).toHaveCount(1)
		await expect(toast).toHaveText('已保存')
		// The next normal save still replaces the one shared notice instead of adding another.
		await successfulField.fill('Final successful draft')
		await expect.poll(() => writes.length).toBe(5)
		await expect(successfulStatus).toHaveAttribute('data-save-status', 'saved')
		await expect(toast).toHaveCount(1)
		await expect(toast).toHaveText('已保存')
		fail = true
		await page
			.locator(failedModule === 'search' ? '#searchEngineList_0_title' : '#list_0_description')
			.fill('Discard this failed draft')
		await expect(failedStatus).toHaveAttribute('data-save-status', 'error')
		await expect(toast).toHaveText('数据库出错')
		await page.getByRole('menuitem', { name: '关于', exact: true }).click()
		const dialog = page.getByRole('dialog')
		await expect(dialog).toContainText('放弃未保存的修改并离开？')
		await dialog.getByRole('button', { name: /确.*定/ }).click()
		await expect(page).toHaveURL(/#\/settings\/about$/)
		await expect(dialog).toHaveCount(0)
		await expect(toast).toHaveCount(0)
	})
}

for (const language of ['zh-CN', 'en-US']) {
	test(`automatic save feedback fits mobile and desktop in ${language}`, async ({ page }, info) => {
		await page.emulateMedia({ reducedMotion: 'reduce' })
		let fail = true
		await fixture(page, async (route) => route.fulfill({ json: { code: fail ? 1200 : 0 } }), language)
		for (const [width, theme] of [
			[320, 0],
			[1440, 1],
		] as const) {
			await page.setViewportSize({ width, height: 844 })
			await page.locator('.theme-picker label').nth(theme).click()
			fail = true
			await page.locator('#logoText').fill(`Feedback ${width}`)
			const status = page.locator('.auto-save-status')
			await expect(status).toHaveAttribute('data-save-status', 'error')
			await page.getByRole('slider').first().scrollIntoViewIfNeeded()
			await expect
				.poll(() => page.locator('.settings-form-content').evaluate((el) => el.scrollWidth <= el.clientWidth))
				.toBe(true)
			for (const child of [status.locator(':scope > span'), status.getByRole('button')])
				await expect(child).toBeInViewport()
			await page.screenshot({
				path: info.outputPath(`${language}-${width}-failed.png`),
				animations: 'disabled',
			})
			fail = false
			await status.getByRole('button').click()
			await expect(status).toHaveAttribute('data-save-status', 'saved')
			await page.screenshot({
				path: info.outputPath(`${language}-${width}-saved.png`),
				animations: 'disabled',
			})
		}
	})
}
