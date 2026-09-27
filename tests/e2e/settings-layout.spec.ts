import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
let admin: { token: string }
async function enter(page: Page, language = 'zh-CN') {
	await page.addInitScript(
		({ user, language }) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: user.token,
						accounts: [{ token: user.token, user }],
						theme: 'light',
						language,
						network: 'wan',
					},
				}),
			),
		{ user: admin, language },
	)
	await page.goto('/#/settings/appearance')
	await page.locator('#logoText').waitFor()
}
test.beforeAll(async ({ request }) => {
	const result = await (
		await request.post('/api/login', { data: { username: 'admin@zpanel.local', password: '12345678' } })
	).json()
	expect(result.code).toBe(0)
	admin = result.data
})
for (const language of ['zh-CN', 'en-US']) {
	test(`theme choices fit narrow content in ${language} and both themes`, async ({ page }) => {
		await enter(page, language)
		await expect(page.locator('html')).toHaveAttribute('lang', language)
		for (const width of [320, 390, 640, 641, 700, 900, 1440]) {
			await page.setViewportSize({ width, height: 844 })
			for (const theme of ['light', 'dark']) {
				await page
					.locator('.theme-picker label')
					.nth(theme === 'light' ? 0 : 1)
					.click()
				await expect
					.poll(() =>
						page.locator('.settings-form-content').evaluate((el) => el.scrollWidth <= el.clientWidth),
					)
					.toBeTruthy()
				const bounds = await page.locator('.theme-picker').evaluate((el) => {
					const parent = el.closest('.settings-form-content')!.getBoundingClientRect()
					return [...el.querySelectorAll('label')].every((label) => {
						const r = label.getBoundingClientRect()
						return r.left >= parent.left && r.right <= parent.right
					})
				})
				expect(bounds, `${language} ${width} ${theme}`).toBeTruthy()
			}
		}
	})
}
test('keyboard focus stays above the footer with and without the draft warning', async ({ page }) => {
	await enter(page)
	await page.setViewportSize({ width: 390, height: 844 })
	for (const dirty of [false, true]) {
		if (dirty) await page.locator('#logoText').fill('Keyboard draft')
		await page.locator('#logoText').focus()
		let checked = 0
		for (let i = 0; i < 38; i++) {
			await page.keyboard.press('Tab')
			const bounds = await page.evaluate(() => {
				const el = document.activeElement
				if (!el?.closest('.settings-form-content')) return null
				const r = el.getBoundingClientRect()
				const footer = document.querySelector('.save-bar')!.getBoundingClientRect()
				return { id: el.id, bottom: r.bottom, footerTop: footer.top }
			})
			if (bounds) {
				checked++
				expect(bounds.bottom, `${dirty} ${bounds.id}`).toBeLessThanOrEqual(bounds.footerTop)
			}
		}
		expect(checked).toBeGreaterThan(15)
	}
})
test('long identity stays contained and a failed logo recovers when its URL changes', async ({ page }) => {
	await enter(page)
	await page.setViewportSize({ width: 320, height: 844 })
	await page.route('**/broken-logo.png', (route) => route.fulfill({ status: 404, body: '' }))
	await page.locator('#logoText').fill('Homelab'.repeat(30))
	await page.locator('#logoImageSrc').fill('/broken-logo.png')
	await expect(page.locator('.identity-preview img')).toHaveCount(0)
	await expect(page.locator('.identity-mark')).toContainText('H')
	await expect
		.poll(() => page.locator('.settings-form-content').evaluate((el) => el.scrollWidth <= el.clientWidth))
		.toBeTruthy()
	await page.locator('#logoImageSrc').fill('/favicon.svg')
	await expect(page.locator('.identity-preview img')).toBeVisible()
	await expect
		.poll(() =>
			page.locator('.identity-preview img').evaluate((el) => (el as HTMLImageElement).naturalWidth > 0),
		)
		.toBeTruthy()
})
