import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const groups = [
	{ id: 8801, title: 'Bookmarks', items: [] },
	{ id: 8802, title: 'Work', items: [] },
]

async function fixture(
	page: Page,
	{
		language = 'zh-CN',
		theme = 'light',
		publicHome = false,
		captcha = false,
	}: {
		language?: string
		theme?: 'light' | 'dark'
		publicHome?: boolean
		captcha?: boolean
	} = {},
) {
	await page.addInitScript(
		({ language, theme, publicHome }) => {
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						language,
						theme,
						token: publicHome ? null : 'ui-accessibility-fixture',
						accounts: [],
						network: 'wan',
						homeEditHintDismissed: true,
					},
				}),
			)
		},
		{ language, theme, publicHome },
	)
	await page.route('**/api/openness/loginConfig', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					loginCaptcha: captcha,
					siteSetting: { siteTitle: 'ZPanel', loginTitle: 'ZPanel', loginSubtitle: 'Your apps in one place' },
				},
			},
		}),
	)
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({
			json: { code: 0, data: { user: { id: 8800, role: 1 }, visitMode: publicHome ? 1 : 0 } },
		}),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({ json: { code: 0, data: { panel: {} } } }),
	)
	await page.route('**/api/system/moduleConfig/getByName', (route) =>
		route.fulfill({ json: { code: 0, data: null } }),
	)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({ json: { code: 0, data: groups } }),
	)
}

async function material(surface: Locator) {
	await expect(surface).toBeVisible()
	const styles = await surface.evaluate((element) => {
		const style = getComputedStyle(element)
		return {
			background: style.backgroundColor,
			color: style.color,
			blur: style.backdropFilter,
			shadow: style.boxShadow,
			portal: !element.closest('.app-root'),
		}
	})
	expect(styles.portal).toBe(true)
	expect(styles.background).not.toBe('rgba(0, 0, 0, 0)')
	expect(styles.blur).toContain('blur(')
	expect(styles.shadow).not.toBe('none')
	return styles
}

for (const language of ['zh-CN', 'de-DE', 'ru-RU']) {
	test(`public login toolbar keeps both controls reachable at 320px in ${language}`, async ({
		page,
	}, info) => {
		await page.setViewportSize({ width: 320, height: 640 })
		await fixture(page, { language, publicHome: true })
		await page.goto('/#/')
		await page.locator('.home-tools button').last().click()
		await expect(page.locator('.login-toolbar')).toBeVisible()
		const back = page.locator('.login-back')
		const select = page.locator('.login-language')
		const first = (await back.boundingBox())!
		const second = (await select.boundingBox())!
		const toolbar = (await page.locator('.login-toolbar').boundingBox())!
		const form = (await page.locator('.login-form').boundingBox())!
		expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(form.y)
		const overlap =
			Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)) *
			Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y))
		expect(overlap).toBe(0)
		for (const bounds of [first, second]) {
			expect(bounds.x).toBeGreaterThanOrEqual(0)
			expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
		}
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
			.toBe(true)
		await back.focus()
		await expect(back).toBeFocused()
		await page.keyboard.press('Tab')
		await expect(select.getByRole('combobox')).toBeFocused()
		await select.getByRole('combobox').press('Enter', { delay: 100 })
		await expect(page.locator('.glass-select-popup')).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(page.locator('.glass-select-popup')).toBeHidden()
		await expect(select.getByRole('combobox')).toBeFocused()
		await page.screenshot({ path: info.outputPath(`login-toolbar-${language}.png`), animations: 'disabled' })
		await back.click()
		await expect(page.locator('.home-page')).toBeVisible()
	})
}

for (const language of ['zh-CN', 'en-US']) {
	test(`captcha label and required feedback are usable in ${language}`, async ({ page }) => {
		await fixture(page, { language, captcha: true })
		await page.goto('/#/login')
		const english = language === 'en-US'
		const code = page.getByRole('textbox', {
			name: english ? 'Enter captcha to continue' : '请输入验证码继续',
			exact: true,
		})
		await expect(code).toBeVisible()
		await page.locator('label[for="vcode"]').click()
		await expect(code).toBeFocused()
		await page.getByRole('textbox', { name: english ? 'Username' : '账号', exact: true }).fill('fixture-user')
		await page.getByLabel(english ? 'Password' : '密码', { exact: true }).fill('fixture-password')
		await page.locator('button[type="submit"]').click()
		await expect(
			page.getByText(english ? 'Captcha is required' : '验证码必须填写', { exact: true }),
		).toBeVisible()
		await expect(code).toHaveAttribute('aria-invalid', 'true')
		await expect(code).toHaveAccessibleDescription(english ? 'Captcha is required' : '验证码必须填写')
	})

	test(`keyboard sorting describes names and positions in ${language}`, async ({ page }) => {
		await fixture(page, { language })
		const saves: number[][] = []
		await page.route('**/api/panel/itemIconGroup/saveSort', (route) => {
			saves.push(
				route
					.request()
					.postDataJSON()
					.sortItems.map((item: { id: number }) => item.id),
			)
			return route.fulfill({ json: { code: 0, data: null } })
		})
		await page.goto('/#/settings/groups')
		const handle = page.getByRole('button', { name: /Bookmarks.*拖动排序|Reorder Bookmarks/ })
		await handle.focus()
		const instruction = await handle.getAttribute('aria-describedby')
		await expect(page.locator(`[id="${instruction}"]`)).toContainText(
			language === 'en-US' ? 'Press Space' : '按空格拾起项目',
		)
		await page.keyboard.press('Space', { delay: 100 })
		await expect(handle).toHaveAttribute('aria-pressed', 'true')
		await expect(page.getByRole('status')).toContainText('Bookmarks')
		await page.keyboard.press('ArrowDown')
		await expect(page.getByRole('status')).toContainText(
			language === 'en-US' ? 'position 2 of 2' : '第 2 项，共 2 项',
		)
		await page.keyboard.press('Escape')
		await expect(page.getByRole('status')).toContainText(language === 'en-US' ? 'cancelled' : '已取消')
		await expect(handle).toBeFocused()
		expect(saves).toHaveLength(0)
		await page.keyboard.press('Space', { delay: 100 })
		await expect(handle).toHaveAttribute('aria-pressed', 'true')
		await page.keyboard.press('ArrowDown')
		await expect(page.getByRole('status')).toContainText(
			language === 'en-US' ? 'position 2 of 2' : '第 2 项，共 2 项',
		)
		await page.keyboard.press('Space')
		await expect.poll(() => saves.length).toBe(1)
		expect(saves[0]).toEqual([8802, 8801])
		await expect(page.getByRole('status')).toContainText(
			language === 'en-US' ? 'Dropped Bookmarks at position 2 of 2' : 'Bookmarks已放到第 2 项，共 2 项',
		)
		await expect(page.getByRole('status')).not.toContainText(/8801|8802|draggable item|droppable area/)
	})
}

for (const theme of ['light', 'dark'] as const) {
	test(`portaled select, tooltip, modal and feedback share readable ${theme} glass`, async ({
		page,
	}, info) => {
		await fixture(page, { theme })
		await page.goto('/#/')
		await page.getByRole('button', { name: '设置', exact: true }).hover()
		const tooltip = await material(page.locator('.glass-tooltip'))
		const ink = tooltip.color
			.match(/[\d.]+/g)!
			.slice(0, 3)
			.map(Number)
		expect(ink.every((channel) => (theme === 'dark' ? channel > 200 : channel < 70))).toBe(true)
		await page.getByRole('button', { name: 'Bookmarks 添加项目', exact: true }).click()
		const modal = page.locator('.glass-modal-container')
		await material(modal)
		await page.getByRole('combobox', { name: '分组', exact: true }).click()
		await material(page.locator('.glass-select-popup'))
		await page.keyboard.press('Escape')
		await expect(page.locator('.glass-select-popup')).toBeHidden()
		await page.screenshot({ path: info.outputPath(`popup-${theme}.png`), animations: 'disabled' })
		await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).focus()
		await page.keyboard.press('Escape')
		await expect(page.getByRole('dialog')).toHaveCount(0)
		await page.route('**/api/login', (route) =>
			route.fulfill({ json: { code: 9999, msg: 'UI feedback failure' } }),
		)
		await page.goto('/#/login')
		await page.getByLabel('账号', { exact: true }).fill('fixture-user')
		await page.getByLabel('密码', { exact: true }).fill('fixture-password')
		await page.locator('button[type="submit"]').click()
		await material(page.locator('.glass-message'))
		await expect(page.locator('.glass-message')).toContainText('UI feedback failure')
	})
}
