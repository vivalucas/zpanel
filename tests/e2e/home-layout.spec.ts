import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

const app = {
	id: 1701,
	title: 'Layout app',
	description: '常用应用与项目资料',
	url: '/favicon.svg?layout=app',
	openMethod: 3,
	icon: { itemType: 1, text: 'Z', backgroundColor: '#eef0ff' },
}
const groups = [
	{ id: 1700, title: '常用网站', count: 18 },
	{ id: 1800, title: 'AI', count: 11 },
	{ id: 1900, title: '工作', count: 9 },
].map(({ id, title, count }) => ({
	id,
	title,
	items: Array.from({ length: count }, (_, index) => ({
		...app,
		id: id + index + 1,
		itemIconGroupId: id,
		title: id === 1700 && !index ? app.title : `${title} ${index + 1}`,
	})),
}))
interface Fixture {
	panel?: Record<string, unknown>
	hint?: boolean
	warning?: boolean
	empty?: boolean
	partialError?: boolean
	navigation?: 'ready' | 'error' | 'loading'
	release?: () => void
}
let fixtureId = 0

async function home(page: Page, fixture: Fixture = {}) {
	await page.addInitScript(({ hint }) => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'home-layout-fixture',
					accounts: [],
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
					homeEditHintDismissed: !hint,
				},
			}),
		)
	}, { hint: fixture.hint || false })
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({ json: { code: 0, data: { user: { id: 170, role: 2 }, visitMode: 0 } } }),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					panel: { logoText: 'Hi!', ...fixture.panel },
					panelWarnings: fixture.warning ? ['marginTop'] : [],
				},
			},
		}),
	)
	const navigationGate = new Promise<void>((resolve) => {
		fixture.release = resolve
	})
	await page.route('**/api/panel/itemIconGroup/getNavigation', async (route) => {
		if (fixture.navigation === 'loading') await navigationGate
		if (fixture.navigation === 'error')
			return route.fulfill({ status: 500, json: { msg: 'Layout fixture failure' } })
		return route.fulfill({
			json: { code: 0, data: fixture.empty ? [] : [...groups, { id: 2000, title: '工具', items: [] }] },
		})
	})
	await page.route('**/api/system/moduleConfig/getByName', (route) => {
		if (fixture.partialError)
			return route.fulfill({ status: 500, json: { msg: 'Layout fixture failure' } })
		const name = route.request().postDataJSON().name
		return route.fulfill({
			json: {
				code: 0,
				data: name === 'module-systemMonitor' ? { list: [{ key: 'cpu', monitorType: 'cpu' }] } : null,
			},
		})
	})
	await page.route('**/api/system/monitor/getCpuState', (route) =>
		route.fulfill({ json: { code: 0, data: { usages: [12, 18], coreCount: 2 } } }),
	)
	await page.goto(`/?layoutFixture=${++fixtureId}#/`)
	if (fixture.navigation === 'loading') await expect(page.locator('.loading-state')).toBeVisible()
	else if (fixture.navigation === 'error') await expect(page.locator('.error-page')).toBeVisible()
	else await expect(page.locator('.home-page')).toBeVisible()
}

async function box(locator: Locator) {
	await expect(locator).toBeVisible()
	return (await locator.boundingBox())!
}
async function follows(before: Locator, after: Locator) {
	const first = await box(before)
	const second = await box(after)
	expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1)
}
async function noHorizontalOverflow(page: Page) {
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function headerLayout(page: Page, width: number, sideBySide = width >= 1024) {
	const identity = await box(page.locator('.home-identity'))
	const search = await box(page.locator('.search-box'))
	const leadingIdentity = await box(page.locator('.home-logo-image, .home-logo-text').first())
	expect(leadingIdentity.x).toBeCloseTo(identity.x, 0)
	if (sideBySide) {
		expect(search.x).toBeGreaterThanOrEqual(identity.x + identity.width)
		expect(Math.abs(identity.y + identity.height / 2 - search.y - search.height / 2)).toBeLessThanOrEqual(1)
	} else {
		await follows(page.locator('.home-identity'), page.locator('.search-box'))
		expect(search.x).toBeCloseTo(identity.x, 0)
	}
}
async function snapshot(page: Page, info: TestInfo, name: string) {
	await page.screenshot({ path: info.outputPath(`${name}.png`), animations: 'disabled' })
	await info.attach(`${name}-layout`, {
		contentType: 'application/json',
		body: JSON.stringify(
			await page.locator('.home-page').evaluate((root) => {
				const bounds = (selector: string) => {
					const element = root.querySelector(selector)
					if (!element) return null
					const { x, y, width, height } = element.getBoundingClientRect()
					return { x, y, width, height }
				}
				return {
					viewport: { width: innerWidth, height: innerHeight },
					identity: bounds('.home-identity'),
					search: bounds('.search-box'),
					firstGroup: bounds('.navigation-group'),
					firstIcon: bounds('.item-icon'),
					pageHeight: document.documentElement.scrollHeight,
				}
			}),
			null,
			2,
		),
	})
}

test('default home brings usable 70px icons into the first screen at desktop and mobile sizes', async ({ page }, info) => {
	test.setTimeout(60_000)
	await home(page)
	for (const viewport of [
		{ width: 1440, height: 900, iconTop: 240 },
		{ width: 2557, height: 1229, iconTop: 280 },
		{ width: 2560, height: 900, iconTop: 250 },
		{ width: 1920, height: 720, iconTop: 230 },
		{ width: 320, height: 640, iconTop: 250 },
		{ width: 390, height: 844, iconTop: 250 },
		{ width: 844, height: 390, iconTop: 250 },
	]) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height })
		await expect(page.locator('.item-icon').first()).toBeInViewport({ ratio: 1 })
		const icon = await box(page.locator('.item-icon').first())
		expect(icon.y).toBeGreaterThanOrEqual(0)
		expect(icon.y).toBeLessThanOrEqual(viewport.iconTop)
		expect(icon.y + icon.height).toBeLessThan(viewport.height)
		expect(icon.width).toBe(70)
		expect(icon.height).toBe(70)
		expect((await box(page.locator('.search-box'))).height).toBeGreaterThanOrEqual(44)
		await headerLayout(page, viewport.width)
		await follows(page.locator('.home-hero'), page.locator('.navigation-group').first())
		await noHorizontalOverflow(page)
		await snapshot(page, info, `default-${viewport.width}x${viewport.height}`)
	}
})

test('a configured narrow content width stacks the header even on a wide desktop', async ({ page }, info) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	await home(page, { panel: { maxWidth: 600, maxWidthUnit: 'px' } })
	await headerLayout(page, 1440, false)
	await follows(page.locator('.home-hero'), page.locator('.navigation-group').first())
	await expect(page.getByRole('textbox', { name: '搜索', exact: true })).toBeInViewport({ ratio: 1 })
	await noHorizontalOverflow(page)
	await snapshot(page, info, 'configured-narrow-width')
})

test('long identities leave tools accessible across narrow desktop and low-height breakpoints', async ({ page }, info) => {
	test.setTimeout(60_000)
	for (const marginTop of [0, 10]) {
		await home(page, {
			panel: {
				marginTop,
				logoText: '我的家庭工作台与常用应用'.repeat(8),
				logoImageSrc: '/favicon.svg',
				clockShowSecond: true,
			},
		})
		await expect.poll(() => page.locator('.home-logo-image').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
		for (const viewport of [
			{ width: 640, height: 600 },
			{ width: 641, height: 600 },
			{ width: 641, height: 601 },
			{ width: 641, height: 390 },
			{ width: 700, height: 320 },
			{ width: 900, height: 300 },
			{ width: 1023, height: 600 },
			{ width: 1024, height: 600 },
			{ width: 1440, height: 900 },
		]) {
			await page.setViewportSize(viewport)
			const tools = await box(page.locator('.home-tools'))
			for (const selector of ['.home-hero', '.home-logo-text', '.home-logo-image', '.clock']) {
				const identity = await box(page.locator(selector))
				const overlap = Math.max(0, Math.min(identity.x + identity.width, tools.x + tools.width) - Math.max(identity.x, tools.x))
					* Math.max(0, Math.min(identity.y + identity.height, tools.y + tools.height) - Math.max(identity.y, tools.y))
				expect(overlap, `${selector}: margin ${marginTop}, ${viewport.width}×${viewport.height}`).toBe(0)
			}
			const settings = page.getByRole('button', { name: '设置', exact: true })
			await expect(settings).toBeInViewport({ ratio: 1 })
			expect(await settings.evaluate((button) => {
				const rect = button.getBoundingClientRect()
				return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
			})).toBe(true)
			expect((await box(page.locator('.search-box'))).height).toBeGreaterThanOrEqual(44)
			await headerLayout(page, viewport.width)
			await noHorizontalOverflow(page)
			if (marginTop !== 10 || viewport.width !== 641 || viewport.height !== 390) continue
			await snapshot(page, info, 'long-identity-641x390')
			const link = page.getByRole('link', { name: app.title, exact: true })
			await page.getByRole('textbox', { name: '搜索', exact: true }).focus()
			for (let tab = 0; tab < 10 && !(await link.evaluate((element) => element === document.activeElement)); tab++)
				await page.keyboard.press('Tab')
			await expect(link).toBeFocused()
			await page.keyboard.press('Enter')
			await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', app.url)
			await page.keyboard.press('Escape')
			await expect(link).toBeFocused()
			await page.keyboard.press('Shift+F10')
			await expect(page.locator('.item-action-popup')).toBeVisible()
			await page.keyboard.press('Escape')
			await expect(link).toBeFocused()
			await settings.click()
			await expect(page).toHaveURL(/settings\/appearance/)
			const description = page.getByText('按页面宽度计算；窗口较矮时自动收紧，减少顶部留白。', { exact: true })
			await description.scrollIntoViewIfNeeded()
			await expect(description).toBeInViewport({ ratio: 1 })
			await page.screenshot({ path: info.outputPath('top-margin-description-641x390.png'), animations: 'disabled' })
			await page.getByRole('button', { name: '返回首页', exact: true }).click()
			await expect(page.locator('.home-page')).toBeVisible()
		}
	}
})

test('search, hidden search and both navigation styles retain click and keyboard access', async ({ page }) => {
	for (const iconStyle of [1, 2]) {
		await page.setViewportSize({ width: iconStyle === 1 ? 1440 : 390, height: 844 })
		await home(page, { panel: { iconStyle } })
		const link = page.getByRole('link', { name: app.title, exact: true })
		await link.click()
		await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', app.url)
		await page.keyboard.press('Escape')
		await link.focus()
		await page.keyboard.press('Enter')
		await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', app.url)
		await page.keyboard.press('Escape')
		const search = page.getByRole('textbox', { name: '搜索', exact: true })
		await search.fill('no-matching-layout-app')
		await expect(page.getByText('没有找到匹配的应用')).toBeVisible()
		await follows(page.locator('.home-hero'), page.locator('.empty-collection'))
		await search.clear()
		await expect(link).toBeVisible()
		const withSearch = (await box(page.locator('.navigation-group').first())).y
		await home(page, { panel: { iconStyle, searchBoxShow: false } })
		await expect(search).toHaveCount(0)
		const withoutSearch = (await box(page.locator('.navigation-group').first())).y
		if (iconStyle === 1) expect(withoutSearch).toBeLessThanOrEqual(withSearch)
		else expect(withoutSearch).toBeLessThan(withSearch)
		const hero = await box(page.locator('.home-hero'))
		const identity = await box(page.locator('.home-identity'))
		expect(identity.width).toBeCloseTo(hero.width, 0)
		expect(hero.height).toBeCloseTo(identity.height, 0)
		await follows(page.locator('.home-identity'), page.locator('.navigation-group').first())
		await noHorizontalOverflow(page)
	}
})

test('custom top margins retain narrow-screen percentages and wide-screen scaling; bottom keeps its percentage', async ({ page }) => {
	test.setTimeout(60_000)
	for (const viewport of [{ width: 320, height: 844 }, { width: 1920, height: 720 }]) {
		await page.setViewportSize(viewport)
		let previousTop = -1
		for (const marginTop of [0, 10, 20]) {
			await home(page, { panel: { marginTop, marginBottom: 7 } })
			const geometry = await page.locator('.home-content').evaluate((content) => ({
				top: content.getBoundingClientRect().top,
				parentWidth: content.parentElement!.getBoundingClientRect().width,
				bottom: parseFloat(getComputedStyle(content).marginBottom),
			}))
			expect(geometry.bottom).toBeCloseTo(geometry.parentWidth * 0.07, 1)
			if (!marginTop) expect(geometry.top).toBe(0)
			else if (viewport.width === 320)
				expect(geometry.top).toBeCloseTo((geometry.parentWidth * marginTop) / 100, 1)
			else expect(geometry.top).toBeLessThan((geometry.parentWidth * marginTop) / 100)
			expect(geometry.top).toBeGreaterThan(previousTop)
			previousTop = geometry.top
			await noHorizontalOverflow(page)
		}
	}
})

test('repair notice, monitors, editing hint and empty groups occupy separate normal-flow space', async ({ page }, info) => {
	await home(page, {
		hint: true,
		warning: true,
		panel: { systemMonitorShow: true, systemMonitorShowTitle: true },
	})
	await expect(page.locator('.monitor-card strong')).toHaveText('15.0%')
	for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 640 }]) {
		await page.setViewportSize(viewport)
		await follows(page.locator('.home-content > .ant-alert'), page.locator('.home-hero'))
		await follows(page.locator('.home-hero'), page.locator('.monitor-section'))
		await follows(page.locator('.monitor-section'), page.locator('.home-edit-hint'))
		await follows(page.locator('.home-edit-hint'), page.locator('.navigation-group').first())
		const empty = page.locator('.navigation-group').last()
		await follows(empty.locator('.group-heading'), empty.locator('.empty-group'))
		await expect(empty.getByRole('button', { name: '添加第一个应用', exact: true })).toBeVisible()
		await noHorizontalOverflow(page)
		await snapshot(page, info, `stacked-${viewport.width}`)
	}
	await page.getByRole('button', { name: '知道了', exact: true }).click()
	await expect(page.locator('.home-edit-hint')).toHaveCount(0)
})

test('partial search and monitor failures keep retry controls separate from links and recover', async ({ page }, info) => {
	const fixture: Fixture = { hint: true, partialError: true, panel: { systemMonitorShow: true } }
	await home(page, fixture)
	await expect(page.locator('.home-page .status-state')).toHaveCount(2)
	for (const viewport of [{ width: 1920, height: 720 }, { width: 320, height: 640 }]) {
		await page.setViewportSize(viewport)
		await follows(page.locator('.search-box'), page.locator('.home-hero > .status-state'))
		await follows(page.locator('.home-hero'), page.locator('.home-content > .status-state'))
		await follows(page.locator('.home-content > .status-state'), page.locator('.home-edit-hint'))
		await follows(page.locator('.home-edit-hint'), page.locator('.navigation-group').first())
		await noHorizontalOverflow(page)
		await snapshot(page, info, `partial-error-${viewport.width}`)
	}
	fixture.partialError = false
	await page.locator('.home-hero').getByRole('button', { name: '重试', exact: true }).click()
	await page.locator('.home-content > .status-state').getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.locator('.home-page .status-state')).toHaveCount(0)
	await expect(page.locator('.monitor-card strong')).toHaveText('15.0%')
	await expect(page.getByRole('link', { name: app.title, exact: true })).toBeVisible()
})

test('initial loading and failures avoid false empty content, then retry restores a usable empty home', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 640 })
	const fixture: Fixture = { navigation: 'loading', empty: true }
	await home(page, fixture)
	await expect(page.locator('.home-page')).toHaveCount(0)
	await expect(page.locator('.empty-collection')).toHaveCount(0)
	fixture.navigation = 'error'
	fixture.release!()
	await expect(page.locator('.error-page .status-state')).toBeVisible()
	await expect(page.locator('.empty-collection')).toHaveCount(0)
	await noHorizontalOverflow(page)
	fixture.navigation = 'ready'
	await page.getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.locator('.empty-collection')).toBeVisible()
	await expect(page.locator('.error-page')).toHaveCount(0)
	await follows(page.locator('.home-hero'), page.locator('.empty-collection'))
	await expect(page.getByRole('button', { name: '添加分组', exact: true })).toBeVisible()
	await noHorizontalOverflow(page)
})
