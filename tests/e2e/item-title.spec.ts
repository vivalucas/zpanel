import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const shortTitle = 'Mail'
const longTitle =
	'A very long application name whose complete text should appear only when the visible name is truncated'
let fixture = 0

async function home(page: Page, iconStyle: number, titles = [shortTitle, longTitle], hideTitle = false) {
	const items = titles.map((title, index) => ({
		id: 7801 + index,
		title,
		url: `/favicon.svg?title-app=${index}`,
		lanUrl: `/favicon.svg?title-lan=${index}`,
		openMethod: 3,
		itemIconGroupId: 7800,
		icon: { itemType: 2, src: '/title-icon.svg', backgroundColor: '#ffffff' },
	}))
	await page.addInitScript(() => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'title-fixture',
					accounts: [],
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
					homeEditHintDismissed: true,
				},
			}),
		)
	})
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({ json: { code: 0, data: { user: { id: 78, role: 2 }, visitMode: 0 } } }),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					panel: { iconStyle, iconTextIconHideTitle: hideTitle, marginTop: 0, searchBoxShow: false },
					panelWarnings: [],
				},
			},
		}),
	)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({ json: { code: 0, data: [{ id: 7800, title: 'Title group', items }] } }),
	)
	await page.route('**/api/panel/itemIcon/edit', async (route) => {
		const changed = route.request().postDataJSON() as { id: number; title: string }
		const item = items.find((entry) => entry.id === changed.id)
		if (item) item.title = changed.title
		await route.fulfill({ json: { code: 0, data: null } })
	})
	await page.route('**/api/system/moduleConfig/getByName', (route) =>
		route.fulfill({ json: { code: 0, data: null } }),
	)
	await page.route('**/title-icon.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="16" fill="#5266eb"/><path d="M28 28h40L28 68h40" fill="none" stroke="white" stroke-width="8"/></svg>',
		}),
	)
	await page.goto(`/?titleFixture=${++fixture}#/`)
	await expect(page.locator('.navigation-card')).toHaveCount(items.length)
	await expect
		.poll(() =>
			page
				.locator('.item-icon img')
				.first()
				.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
		)
		.toBe(true)
	await page.evaluate(async () => {
		await document.fonts.ready
	})
}

const app = (page: Page, name: string) => page.getByRole('link', { name, exact: true })
const label = (link: Locator) => link.locator('.app-copy strong')
const truncated = (title: Locator) => title.evaluate((element) => element.scrollWidth > element.clientWidth)

async function hoverWithoutTooltip(page: Page, target: Locator) {
	await target.hover()
	// Allow Ant Design's hover delay to expire so an absent tooltip cannot pass before it opens.
	await page.waitForTimeout(300)
	await expect(page.getByRole('tooltip')).toHaveCount(0)
}

async function leaveLabel(page: Page) {
	await page.mouse.move(1, 1)
	await expect(page.getByRole('tooltip')).toHaveCount(0)
}

for (const iconStyle of [1, 2]) {
	test(`style ${iconStyle}: only a truncated name shows its full text, while icons have no URL or tooltip`, async ({
		page,
	}, info) => {
		await home(page, iconStyle)
		const short = app(page, shortTitle)
		const long = app(page, longTitle)
		await expect.poll(() => truncated(label(short))).toBe(false)
		await expect.poll(() => truncated(label(long))).toBe(true)
		for (const link of [short, long]) {
			await expect(link).not.toHaveAttribute('title')
			await expect(link.locator('[title]')).toHaveCount(0)
			expect(
				await link.locator('.item-icon img').evaluate((image) => {
					const titles = []
					for (let node: Element | null = image; node; node = node.parentElement) {
						const title = node.getAttribute('title')
						if (title) titles.push(title)
					}
					return titles
				}),
			).toEqual([])
			await hoverWithoutTooltip(page, link.locator('.item-icon'))
		}
		await hoverWithoutTooltip(page, label(short))
		await label(long).hover()
		await expect(page.getByRole('tooltip')).toHaveText(longTitle)
		await page.screenshot({ path: info.outputPath(`item-title-${iconStyle}.png`), animations: 'disabled' })
		await leaveLabel(page)

		await short.locator('.item-icon').click()
		await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', '/favicon.svg?title-app=0')
		await page.keyboard.press('Escape')
		await expect(short).toBeFocused()
		await short.click({ button: 'right' })
		await expect(page.getByRole('menu', { name: `更多操作 ${shortTitle}`, exact: true })).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(short).toBeFocused()
		await page.keyboard.press('Shift+F10')
		await expect(page.getByRole('menuitem', { name: '打开主地址', exact: true })).toBeFocused()
		await page.keyboard.press('Escape')
		await expect(short).toBeFocused()
	})

	test(`style ${iconStyle}: resizing the same label enables and removes the full-name tooltip`, async ({
		page,
	}) => {
		await home(page, iconStyle, [longTitle])
		const link = app(page, longTitle)
		const title = label(link)
		const resize = (width: number) =>
			link.locator('..').evaluate((card, width) => {
				;(card as HTMLElement).style.width = `${width}px`
			}, width)
		await resize(130)
		await expect.poll(() => truncated(title)).toBe(true)
		await title.hover()
		await expect(page.getByRole('tooltip')).toHaveText(longTitle)
		await leaveLabel(page)
		await resize(1000)
		await expect.poll(() => truncated(title)).toBe(false)
		await hoverWithoutTooltip(page, title)
		await leaveLabel(page)
		await resize(130)
		await expect.poll(() => truncated(title)).toBe(true)
		await title.hover()
		await expect(page.getByRole('tooltip')).toHaveText(longTitle)
	})
}

test('renaming an app refreshes tooltip eligibility after saving', async ({ page }) => {
	for (const iconStyle of [1, 2]) {
		await home(page, iconStyle, [shortTitle])
		const link = app(page, shortTitle)
		await expect.poll(() => truncated(label(link))).toBe(false)
		await link.click({ button: 'right' })
		await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
		await page.getByRole('dialog').getByLabel('标题', { exact: true }).fill(longTitle)
		await page
			.getByRole('dialog')
			.getByRole('button', { name: /确.*定/ })
			.click()
		await expect(page.getByRole('dialog')).toHaveCount(0)
		const renamed = app(page, longTitle)
		await expect.poll(() => truncated(label(renamed))).toBe(true)
		await label(renamed).hover()
		await expect(page.getByRole('tooltip')).toHaveText(longTitle)
		await leaveLabel(page)
	}
})

test('hidden icon-style names have no title tooltip', async ({ page }) => {
	await home(page, 1, [longTitle], true)
	const link = app(page, longTitle)
	await expect(label(link)).toHaveCount(0)
	await expect(link).not.toHaveAttribute('title')
	await hoverWithoutTooltip(page, link.locator('.item-icon'))
	await expect(link).toHaveAttribute('aria-label', longTitle)
})
