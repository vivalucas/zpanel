import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function enter(page: Page, section = 'appearance', language = 'zh-CN') {
	await page.addInitScript((language) => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: { token: 'ui-appearance-fixture', theme: 'light', language, network: 'wan', accounts: [] },
			}),
		)
	}, language)
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { user: { id: 1701, name: 'UI test', role: 1 }, visitMode: 0 },
			},
		}),
	)
	await page.route('**/api/openness/loginConfig', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { siteSetting: { siteTitle: 'UI test' }, loginCaptcha: false },
			},
		}),
	)
	await page.goto(`/#/settings/${section}`)
}

for (const language of ['zh-CN', 'en-US']) {
	test(`appearance controls are named and wallpaper sliders update the preview in ${language}`, async ({
		page,
	}) => {
		await page.route('**/api/panel/userConfig/get', (route) =>
			route.fulfill({
				json: {
					code: 0,
					data: { panel: { backgroundImageSrc: '/favicon.svg', backgroundBlur: 0, backgroundMaskNumber: 0 } },
				},
			}),
		)
		await enter(page, 'appearance', language)
		const zh = language === 'zh-CN'
		const blur = page.getByRole('slider', { name: zh ? '壁纸模糊' : 'Wallpaper blur', exact: true })
		const shade = page.getByRole('slider', { name: zh ? '壁纸暗度' : 'Wallpaper darkness', exact: true })
		await expect(blur).toHaveAttribute('aria-valuenow', '0')
		await expect(shade).toHaveAttribute('aria-valuenow', '0')
		await expect(
			page.getByRole('spinbutton', { name: zh ? '最大宽度' : 'Max width', exact: true }),
		).toHaveValue('1200')
		await expect(
			page.getByRole('combobox', { name: zh ? '宽度单位' : 'Width unit', exact: true }),
		).toHaveCount(1)
		await expect(
			page.getByRole('textbox', { name: zh ? '自定义页脚' : 'Custom footer', exact: true }),
		).toHaveCount(1)
		await blur.focus()
		await blur.press('ArrowRight')
		const preview = page.locator('.wallpaper-preview')
		await expect(page.locator('.wallpaper-preview-image')).not.toHaveCSS('filter', 'blur(0px)')
		const size = await preview.boundingBox()
		const viewport = page.viewportSize()!
		const actualBlur = await page
			.locator('.wallpaper-preview-image')
			.evaluate((element) => Number.parseFloat(getComputedStyle(element).filter.replace('blur(', '')))
		expect(actualBlur).toBeCloseTo((3 * size!.width) / viewport.width, 4)
		await shade.focus()
		await shade.press('ArrowRight')
		await expect(page.locator('.wallpaper-preview-shade')).toHaveCSS(
			'background-color',
			'rgba(10, 15, 30, 0.1)',
		)
		await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'pending')
		await page.setViewportSize({ width: 320, height: 640 })
		const toggle = page.locator('.setting-toggle').last()
		await toggle.scrollIntoViewIfNeeded()
		const row = await toggle.evaluate((element) => {
			const label = element.querySelector('label')!.getBoundingClientRect()
			const control = element.querySelector('button')!.getBoundingClientRect()
			return {
				overlapY: label.bottom >= control.top && control.bottom >= label.top,
				separateX: label.right <= control.left,
			}
		})
		expect(row).toEqual({ overlapY: true, separateX: true })
	})
}

test('late wallpaper upload does not overwrite an edited URL even after returning to its original value', async ({
	page,
}) => {
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: { panel: { backgroundImageSrc: '/favicon.svg?original' } },
			},
		}),
	)
	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	let uploading = false
	await page.route('**/api/file/uploadImg', async (route) => {
		uploading = true
		await gate
		await route.fulfill({ json: { code: 0, data: { imageUrl: '/favicon.svg?uploaded' } } })
	})
	const writes: unknown[] = []
	await page.route('**/api/panel/userConfig/set', (route) => {
		writes.push(route.request().postDataJSON())
		return route.fulfill({ json: { code: 0 } })
	})
	await enter(page)
	const url = page.locator('#backgroundImageSrc')
	await expect(url).toHaveValue('/favicon.svg?original')
	await page.locator('input[type=file]').setInputFiles({
		name: 'wallpaper.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vU8AAAAASUVORK5CYII=',
			'base64',
		),
	})
	try {
		await expect.poll(() => uploading).toBeTruthy()
		expect(writes).toHaveLength(0)
		await url.fill('/favicon.svg?newer')
		await url.fill('/favicon.svg?original')
	} finally {
		release()
	}
	await expect.poll(() => writes.length).toBe(1)
	await expect(url).toHaveValue('/favicon.svg?original')
})

for (const section of ['appearance', 'site']) {
	test(`${section} keeps saved values and controls when the follow-up refresh fails`, async ({ page }) => {
		await page.clock.install()
		let saved = false
		if (section === 'appearance') {
			await page.route('**/api/panel/userConfig/get', (route) =>
				route.fulfill({
					json: saved ? { code: 1200 } : { code: 0, data: { panel: { logoText: 'Original title' } } },
				}),
			)
			await page.route('**/api/panel/userConfig/set', (route) => {
				saved = true
				return route.fulfill({ json: { code: 0 } })
			})
		} else {
			await page.route('**/api/panel/userConfig/get', (route) =>
				route.fulfill({ json: { code: 0, data: { panel: {} } } }),
			)
			await page.route('**/api/system/siteSetting/get', (route) =>
				route.fulfill({
					json: saved
						? { code: 1200 }
						: { code: 0, data: { siteSetting: { siteTitle: 'Original title' }, loginCaptcha: false } },
				}),
			)
			await page.route('**/api/system/siteSetting/set', (route) => {
				saved = true
				return route.fulfill({ json: { code: 0 } })
			})
		}
		await enter(page, section)
		const field = page.locator(section === 'appearance' ? '#logoText' : '#siteTitle')
		await field.fill('Saved title')
		if (section === 'site') {
			await expect(page.locator('.settings-draft-hint')).toHaveText('有未保存的更改')
			await page.getByRole('button', { name: '保存', exact: true }).click()
		} else {
			await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
			await page.clock.fastForward(31_000)
			await page.getByRole('menuitem', { name: '关于', exact: true }).click()
			await page.getByRole('menuitem', { name: '风格设置', exact: true }).click()
		}
		await expect(page.locator('.status-state[role="alert"]')).toContainText('刷新失败')
		await expect(field).toHaveValue('Saved title')
		await expect(page.locator('.settings-draft-hint')).toHaveCount(0)
		await expect(field).toBeEnabled()
	})
}
