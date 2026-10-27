import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

const app = {
	id: 1701,
	title: 'Layout app',
	description: '常用应用与项目资料',
	url: '/favicon.svg?layout=app',
	lanUrl: '/favicon.svg?layout=lan',
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
	visitor?: boolean
	theme?: 'light' | 'dark'
	customCss?: string
	release?: () => void
}
let fixtureId = 0

async function home(page: Page, fixture: Fixture = {}) {
	await page.addInitScript(
		({ hint, visitor, theme }) => {
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: visitor ? null : 'home-layout-fixture',
						accounts: [],
						theme,
						language: 'zh-CN',
						network: 'wan',
						homeEditHintDismissed: !hint,
					},
				}),
			)
		},
		{ hint: fixture.hint || false, visitor: fixture.visitor || false, theme: fixture.theme || 'light' },
	)
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({
			json: { code: 0, data: { user: { id: 170, role: 2 }, visitMode: fixture.visitor ? 1 : 0 } },
		}),
	)
	await page.route('**/api/openness/loginConfig', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					siteSetting: { siteTitle: 'Layout fixture', customCss: fixture.customCss || '' },
					loginCaptcha: false,
				},
			},
		}),
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
		if (fixture.partialError) return route.fulfill({ status: 500, json: { msg: 'Layout fixture failure' } })
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
	if (fixture.navigation === 'loading')
		await expect(page.locator('.home-navigation-state .loading-state')).toBeVisible()
	else if (fixture.navigation === 'error')
		await expect(page.locator('.home-navigation-state .status-state')).toBeVisible()
	else {
		await expect(page.locator('.home-page')).toBeVisible()
		await expect(page.locator('.home-navigation-state')).toHaveCount(0)
	}
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
async function bottomTools(page: Page, count = 2) {
	const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
	const bounds = await box(tools)
	const viewport = page.viewportSize()!
	await expect(tools).toHaveCSS('position', 'fixed')
	await expect(tools.locator('button:not(.home-scroll-top)')).toHaveCount(count)
	expect(bounds.y).toBeGreaterThan(viewport.height / 2)
	expect(viewport.width - bounds.x - bounds.width).toBeGreaterThanOrEqual(8)
	expect(viewport.width - bounds.x - bounds.width).toBeLessThanOrEqual(40)
	expect(viewport.height - bounds.y - bounds.height).toBeGreaterThanOrEqual(8)
	expect(viewport.height - bounds.y - bounds.height).toBeLessThanOrEqual(40)
	let previous: Awaited<ReturnType<typeof box>> | undefined
	for (const button of await tools.getByRole('button').all()) {
		const current = await box(button)
		await expect(button).toBeInViewport({ ratio: 1 })
		expect(current.width).toBeGreaterThanOrEqual(44)
		expect(current.height).toBeGreaterThanOrEqual(44)
		if (previous) {
			expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width)
			expect(current.y + current.height / 2).toBeCloseTo(previous.y + previous.height / 2, 1)
		}
		expect(
			await button.evaluate((element) => {
				const rect = element.getBoundingClientRect()
				return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
			}),
		).toBe(true)
		previous = current
	}
	const search = page.locator('.search-box')
	if (await search.count()) {
		const field = await box(search)
		const horizontalGap = Math.max(bounds.x - field.x - field.width, field.x - bounds.x - bounds.width)
		const verticalGap = Math.max(bounds.y - field.y - field.height, field.y - bounds.y - bounds.height)
		expect(
			Math.max(horizontalGap, verticalGap),
			'the dock stays at least 16px away from search',
		).toBeGreaterThanOrEqual(16)
	}
	return bounds
}
async function fixedActionBoxes(page: Page) {
	return page.locator('.home-tools button:not(.home-scroll-top)').evaluateAll((buttons) =>
		buttons.map((button) => {
			const rect = button.getBoundingClientRect()
			return {
				name: button.getAttribute('aria-label'),
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			}
		}),
	)
}
async function expectFixedActions(page: Page, original: Awaited<ReturnType<typeof fixedActionBoxes>>) {
	const current = await fixedActionBoxes(page)
	expect(current.map((button) => button.name)).toEqual(original.map((button) => button.name))
	for (let index = 0; index < original.length; index++)
		for (const axis of ['x', 'y', 'width', 'height'] as const)
			expect(current[index][axis], `${current[index].name} ${axis}`).toBeCloseTo(original[index][axis], 1)
}
async function nativeScroll(page: Page, top: number | 'bottom') {
	await page.evaluate(async (top) => {
		window.scrollTo({
			top: top === 'bottom' ? document.documentElement.scrollHeight : top,
			behavior: 'instant',
		})
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
	}, top)
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
					tools: bounds('.home-tools'),
					footer: bounds('.home-footer-content'),
					pageHeight: document.documentElement.scrollHeight,
				}
			}),
			null,
			2,
		),
	})
}

test('default home brings usable 70px icons into the first screen at desktop and mobile sizes', async ({
	page,
}, info) => {
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
		await bottomTools(page)
		await follows(page.locator('.home-hero'), page.locator('.navigation-group').first())
		await noHorizontalOverflow(page)
		await snapshot(page, info, `default-${viewport.width}x${viewport.height}`)
	}
})

test('a configured narrow content width stacks the header even on a wide desktop', async ({ page }, info) => {
	await page.setViewportSize({ width: 1440, height: 900 })
	await home(page, { panel: { maxWidth: 600, maxWidthUnit: 'px' } })
	await headerLayout(page, 1440, false)
	await bottomTools(page)
	await follows(page.locator('.home-hero'), page.locator('.navigation-group').first())
	await expect(page.getByRole('textbox', { name: '搜索', exact: true })).toBeInViewport({ ratio: 1 })
	await noHorizontalOverflow(page)
	await snapshot(page, info, 'configured-narrow-width')
})

test('long identities leave tools accessible across narrow desktop and low-height breakpoints', async ({
	page,
}, info) => {
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
		await expect
			.poll(() =>
				page.locator('.home-logo-image').evaluate((image) => (image as HTMLImageElement).naturalWidth),
			)
			.toBeGreaterThan(0)
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
			const tools = await bottomTools(page)
			for (const selector of ['.home-hero', '.home-logo-text', '.home-logo-image', '.clock']) {
				const identity = await box(page.locator(selector))
				const overlap =
					Math.max(
						0,
						Math.min(identity.x + identity.width, tools.x + tools.width) - Math.max(identity.x, tools.x),
					) *
					Math.max(
						0,
						Math.min(identity.y + identity.height, tools.y + tools.height) - Math.max(identity.y, tools.y),
					)
				expect(overlap, `${selector}: margin ${marginTop}, ${viewport.width}×${viewport.height}`).toBe(0)
			}
			const settings = page.getByRole('button', { name: '设置', exact: true })
			await expect(settings).toBeInViewport({ ratio: 1 })
			expect(
				await settings.evaluate((button) => {
					const rect = button.getBoundingClientRect()
					return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
				}),
			).toBe(true)
			expect((await box(page.locator('.search-box'))).height).toBeGreaterThanOrEqual(44)
			await headerLayout(page, viewport.width)
			const hero = await box(page.locator('.home-hero'))
			const content = await box(page.locator('.home-content'))
			const contentPadding = await page.locator('.home-content').evaluate((element) => {
				const style = getComputedStyle(element)
				return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
			})
			expect(hero.width, 'the old top-right tool reservation must not constrain the header').toBeCloseTo(
				content.width - contentPadding,
				0,
			)
			await noHorizontalOverflow(page)
			if (marginTop !== 10 || viewport.width !== 641 || viewport.height !== 390) continue
			await snapshot(page, info, 'long-identity-641x390')
			const link = page.getByRole('link', { name: app.title, exact: true })
			await page.getByRole('textbox', { name: '搜索', exact: true }).focus()
			for (
				let tab = 0;
				tab < 10 && !(await link.evaluate((element) => element === document.activeElement));
				tab++
			)
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
			await page.getByRole('button', { name: '外网', exact: true }).focus()
			await page.keyboard.press('Tab')
			await expect(settings).toBeFocused()
			await page.keyboard.press('Enter')
			await expect(page).toHaveURL(/settings\/appearance/)
			const description = page.getByText('按页面宽度计算；窗口较矮时自动收紧，减少顶部留白。', {
				exact: true,
			})
			await description.scrollIntoViewIfNeeded()
			await expect(description).toBeInViewport({ ratio: 1 })
			await page.screenshot({
				path: info.outputPath('top-margin-description-641x390.png'),
				animations: 'disabled',
			})
			await page.getByRole('button', { name: '返回首页', exact: true }).click()
			await expect(page.locator('.home-page')).toBeVisible()
			await bottomTools(page)
		}
	}
})

test('search, hidden search and both navigation styles retain click and keyboard access', async ({
	page,
}) => {
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
		await bottomTools(page)
	}
})

test('bottom tools switch actual application destinations and keep keyboard settings access', async ({
	page,
}, info) => {
	await home(page, { panel: { marginTop: 0 } })
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 390, height: 844 },
		{ width: 641, height: 390 },
	]) {
		await page.setViewportSize(viewport)
		await nativeScroll(page, 0)
		await expect(page.getByRole('button', { name: '回到顶部', exact: true })).toHaveCount(0)
		await bottomTools(page)
		const link = page.getByRole('link', { name: app.title, exact: true })
		await expect(link).toHaveAttribute('href', app.url)
		const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
		await tools.getByRole('button', { name: '外网', exact: true }).click()
		await expect(link).toHaveAttribute('href', app.lanUrl)
		await link.click()
		await expect(page.locator('iframe.app-frame')).toHaveAttribute('src', app.lanUrl)
		await page.keyboard.press('Escape')
		await tools.getByRole('button', { name: '内网', exact: true }).focus()
		await page.keyboard.press('Enter')
		await expect(link).toHaveAttribute('href', app.url)
		expect(
			await page.evaluate(() => JSON.parse(localStorage.getItem('zpanel-preferences')!).state.network),
		).toBe('wan')
		await page.keyboard.press('Tab')
		await expect(tools.getByRole('button', { name: '设置', exact: true })).toBeFocused()
		await page.keyboard.press('Enter')
		await expect(page).toHaveURL(/settings\/appearance/)
		await page.getByRole('button', { name: '返回首页', exact: true }).click()
		await expect(page.locator('.home-page')).toBeVisible()
		await bottomTools(page)
		await noHorizontalOverflow(page)
		await snapshot(page, info, `functional-dock-${viewport.width}x${viewport.height}`)
	}
})

test('long footer content and final group clear the fixed dock at the end of the page', async ({
	page,
}, info) => {
	await home(page, {
		panel: {
			marginTop: 0,
			marginBottom: 0,
			iconStyle: 2,
			footerHtml: `<p>${'页脚较长时仍应完整阅读，工具按钮不能挡住链接与说明。'.repeat(5)}</p><a href="/favicon.svg?layout=footer" target="_blank">页脚链接：阅读完整使用说明与项目介绍</a>`,
		},
	})
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 320, height: 640 },
		{ width: 641, height: 390 },
	]) {
		await page.setViewportSize(viewport)
		await nativeScroll(page, 0)
		await expect(page.getByRole('button', { name: '回到顶部', exact: true })).toHaveCount(0)
		const initial = await bottomTools(page)
		const initialActions = await fixedActionBoxes(page)
		expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(viewport.height)
		await nativeScroll(page, 'bottom')
		await expect(page.getByRole('button', { name: '回到顶部', exact: true })).toBeVisible()
		const tools = await bottomTools(page)
		expect(tools.x + tools.width).toBeCloseTo(initial.x + initial.width, 1)
		expect(tools.y).toBeCloseTo(initial.y, 1)
		await expectFixedActions(page, initialActions)
		const footer = page.locator('.home-footer-content')
		await expect(footer).toBeInViewport({ ratio: 1 })
		await expect(footer.getByRole('link')).toBeInViewport({ ratio: 1 })
		const text = await box(footer)
		expect(text.y + text.height, 'all footer text stays at least 16px above the dock').toBeLessThanOrEqual(
			tools.y - 16,
		)
		const lastGroup = await box(page.locator('.navigation-group').last())
		expect(lastGroup.y + lastGroup.height).toBeLessThanOrEqual(tools.y - 16)
		expect(
			await footer.evaluate((element) => {
				const range = document.createRange()
				range.selectNodeContents(element)
				return [...range.getClientRects()]
					.filter((rect) => rect.width && rect.height)
					.every((rect) =>
						element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
					)
			}),
		).toBe(true)
		await noHorizontalOverflow(page)
		await snapshot(page, info, `footer-clears-dock-${viewport.width}x${viewport.height}`)
	}
})

for (const visitor of [false, true]) {
	test(`a single bottom ${visitor ? 'login' : 'settings'} button remains usable without search`, async ({
		page,
	}, info) => {
		await home(page, { visitor, panel: { netModeChangeButtonShow: false, searchBoxShow: false } })
		for (const viewport of [
			{ width: 320, height: 640 },
			{ width: 641, height: 390 },
			{ width: 1440, height: 900 },
		]) {
			await page.setViewportSize(viewport)
			await bottomTools(page, 1)
			await expect(page.locator('.search-box')).toHaveCount(0)
			await expect(page.getByRole('button', { name: /^(内网|外网)$/ })).toHaveCount(0)
			await noHorizontalOverflow(page)
			await snapshot(page, info, `single-${visitor ? 'visitor' : 'member'}-dock-${viewport.width}`)
		}
		const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
		const action = tools.getByRole('button', { name: visitor ? '登录' : '设置', exact: true })
		if (visitor) {
			await expect(page.locator('.group-actions')).toHaveCount(0)
			await expect(page.getByRole('button', { name: '设置', exact: true })).toHaveCount(0)
		}
		await action.focus()
		await page.keyboard.press('Enter')
		await expect(page).toHaveURL(visitor ? /\/login/ : /settings\/appearance/)
		await page.getByRole('button', { name: '返回首页', exact: true }).click()
		await expect(page.locator('.home-page')).toBeVisible()
		await bottomTools(page, 1)
	})
}

test('custom top margins retain narrow-screen percentages and wide-screen scaling; bottom keeps its percentage', async ({
	page,
}) => {
	test.setTimeout(60_000)
	for (const viewport of [
		{ width: 320, height: 844 },
		{ width: 1920, height: 720 },
	]) {
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

test('repair notice, monitors, editing hint and empty groups occupy separate normal-flow space', async ({
	page,
}, info) => {
	await home(page, {
		hint: true,
		warning: true,
		panel: { systemMonitorShow: true, systemMonitorShowTitle: true },
	})
	await expect(page.locator('.monitor-card strong')).toHaveText('15.0%')
	for (const viewport of [
		{ width: 1440, height: 900 },
		{ width: 320, height: 640 },
	]) {
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

test('partial search and monitor failures keep retry controls separate from links and recover', async ({
	page,
}, info) => {
	const fixture: Fixture = { hint: true, partialError: true, panel: { systemMonitorShow: true } }
	await home(page, fixture)
	await expect(page.locator('.home-page .status-state')).toHaveCount(2)
	for (const viewport of [
		{ width: 1920, height: 720 },
		{ width: 320, height: 640 },
	]) {
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
	await page
		.locator('.home-content > .status-state')
		.getByRole('button', { name: '重试', exact: true })
		.click()
	await expect(page.locator('.home-page .status-state')).toHaveCount(0)
	await expect(page.locator('.monitor-card strong')).toHaveText('15.0%')
	await expect(page.getByRole('link', { name: app.title, exact: true })).toBeVisible()
})

test('initial loading and failures avoid false empty content, then retry restores a usable empty home', async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 640 })
	const fixture: Fixture = { navigation: 'loading', empty: true }
	await home(page, fixture)
	await expect(page.locator('.home-page')).toBeVisible()
	await expect(page.locator('.home-logo-text')).toHaveText('Hi!')
	await expect(page.locator('.empty-collection')).toHaveCount(0)
	fixture.navigation = 'error'
	fixture.release!()
	await expect(page.locator('.home-navigation-state .status-state')).toBeVisible()
	await expect(page.locator('.empty-collection')).toHaveCount(0)
	await noHorizontalOverflow(page)
	fixture.navigation = 'ready'
	await page.getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.locator('.empty-collection')).toBeVisible()
	await expect(page.locator('.home-navigation-state')).toHaveCount(0)
	await follows(page.locator('.home-hero'), page.locator('.empty-collection'))
	await expect(page.getByRole('button', { name: '添加分组', exact: true })).toBeVisible()
	await noHorizontalOverflow(page)
})

declare global {
	interface Window {
		homeLayoutScrollProbe: {
			calls: { top?: number; left?: number; behavior?: ScrollBehavior }[]
			focus: { preventScroll: boolean }[]
			visibility: boolean[]
		}
	}
}

async function observeScroll(page: Page) {
	await page.addInitScript(() => {
		window.homeLayoutScrollProbe = { calls: [], focus: [], visibility: [] }
		const scroll = window.scrollTo
		Object.defineProperty(window, 'scrollTo', {
			configurable: true,
			writable: true,
			value(...args: [ScrollToOptions] | [number, number]) {
				window.homeLayoutScrollProbe.calls.push(
					typeof args[0] === 'number' ? { left: args[0], top: args[1] } : { ...args[0] },
				)
				return Reflect.apply(scroll, window, args)
			},
		})
		const focus = HTMLElement.prototype.focus
		HTMLElement.prototype.focus = function (options?: FocusOptions) {
			if (this.matches('.home-logo-text'))
				window.homeLayoutScrollProbe.focus.push({ preventScroll: options?.preventScroll === true })
			return Reflect.apply(focus, this, [options])
		}
	})
}

const scrollablePanel = {
	iconStyle: 2,
	maxWidth: 800,
	maxWidthUnit: 'px',
	marginTop: 0,
	marginBottom: 0,
	footerHtml: `<p>${'工具按钮不应遮挡长页脚文字。'.repeat(8)}</p><a href="/favicon.svg?layout=back-top-footer" target="_blank">页脚最后一个链接</a>`,
}

for (const theme of ['light', 'dark'] as const) {
	for (const viewport of [
		{ width: 1440, height: 900, reducedMotion: 'no-preference' },
		{ width: 320, height: 640, reducedMotion: 'reduce' },
		{ width: 641, height: 390, reducedMotion: 'no-preference' },
	] as const) {
		test(`back to top expands left and restores focus in ${theme} at ${viewport.width}×${viewport.height}`, async ({
			page,
		}, info) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height })
			await page.emulateMedia({ colorScheme: theme, reducedMotion: viewport.reducedMotion })
			await observeScroll(page)
			await home(page, {
				theme,
				customCss: viewport.reducedMotion === 'reduce' ? 'html { scroll-behavior: smooth !important; }' : '',
				panel: { ...scrollablePanel, iconTextColor: theme === 'dark' ? '#202733' : '#ffffff' },
			})
			if (viewport.reducedMotion === 'reduce')
				await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth')
			const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
			const arrow = tools.getByRole('button', { name: '回到顶部', exact: true })
			const title = page.locator('.home-logo-text')
			await expect(title).toHaveAttribute('tabindex', '-1')
			await expect(arrow).toHaveCount(0)
			const initialDock = await bottomTools(page)
			const initialActions = await fixedActionBoxes(page)
			await nativeScroll(page, 700)
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(700)
			await expect(arrow).toBeVisible()
			await expect(tools.getByRole('button')).toHaveCount(3)
			const expandedDock = await bottomTools(page)
			expect(expandedDock.x).toBeLessThan(initialDock.x)
			expect(expandedDock.x + expandedDock.width).toBeCloseTo(initialDock.x + initialDock.width, 1)
			await expectFixedActions(page, initialActions)
			await expect(tools.getByRole('button').first()).toHaveAccessibleName('回到顶部')
			const separator = await page.locator('.home-scroll-top-slot').evaluate((element) => {
				const style = getComputedStyle(element, '::after')
				return {
					content: style.content,
					width: Number.parseFloat(style.borderInlineEndWidth),
					height: Number.parseFloat(style.height),
					color: style.borderInlineEndColor,
					border: style.borderInlineEndStyle,
				}
			})
			expect(separator.content).not.toBe('none')
			expect(separator.width).toBeGreaterThan(0)
			expect(separator.width).toBeLessThanOrEqual(1.5)
			expect(separator.height).toBeGreaterThanOrEqual(16)
			expect(separator.border).not.toBe('none')
			expect(separator.color).not.toBe('rgba(0, 0, 0, 0)')
			const neutral = await tools
				.getByRole('button', { name: '设置', exact: true })
				.evaluate((element) => getComputedStyle(element).color)
			await arrow.hover()
			await expect(arrow).toHaveCSS('color', neutral)
			await expect(arrow).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
			await page.evaluate(() => {
				window.homeLayoutScrollProbe.calls = []
				window.homeLayoutScrollProbe.focus = []
			})
			await arrow.click()
			if (viewport.reducedMotion === 'reduce') expect(await page.evaluate(() => window.scrollY)).toBe(0)
			await expect(title).toBeFocused()
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
			await expect(arrow).toHaveCount(0)
			expect(await page.evaluate(() => window.homeLayoutScrollProbe.calls.at(-1))).toEqual({
				top: 0,
				behavior: viewport.reducedMotion === 'reduce' ? 'instant' : 'smooth',
			})
			expect(await page.evaluate(() => window.homeLayoutScrollProbe.focus.at(-1))).toEqual({
				preventScroll: true,
			})
			await expectFixedActions(page, initialActions)

			await nativeScroll(page, 'bottom')
			await expect(arrow).toBeVisible()
			await expectFixedActions(page, initialActions)
			const footer = await box(page.locator('.home-footer-content'))
			const dock = await box(tools)
			expect(footer.y + footer.height).toBeLessThanOrEqual(dock.y - 16)
			await expect(page.locator('.home-footer-content a')).toBeInViewport({ ratio: 1 })
			await snapshot(page, info, `back-top-visible-${theme}-${viewport.width}`)
			const settings = tools.getByRole('button', { name: '设置', exact: true })
			await settings.focus()
			await page.keyboard.press('Shift+Tab')
			await expect(tools.getByRole('button', { name: '外网', exact: true })).toBeFocused()
			await page.keyboard.press('Shift+Tab')
			await expect(arrow).toBeFocused()
			await expect(arrow).toHaveCSS('color', neutral)
			const focusStyle = await arrow.evaluate((element) => {
				const style = getComputedStyle(element)
				return {
					visible: element.matches(':focus-visible'),
					width: Number.parseFloat(style.outlineWidth),
					style: style.outlineStyle,
					color: style.outlineColor,
				}
			})
			expect(focusStyle.visible).toBe(true)
			expect(focusStyle.width).toBeGreaterThanOrEqual(2)
			expect(focusStyle.style).not.toBe('none')
			expect(focusStyle.color).toBe(neutral)
			await page.evaluate(() => {
				window.homeLayoutScrollProbe.calls = []
				window.homeLayoutScrollProbe.focus = []
			})
			await page.keyboard.press('Enter')
			if (viewport.reducedMotion === 'reduce') expect(await page.evaluate(() => window.scrollY)).toBe(0)
			await expect(title).toBeFocused()
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
			await expect(arrow).toHaveCount(0)
			expect(await page.evaluate(() => window.homeLayoutScrollProbe.calls.at(-1))).toEqual({
				top: 0,
				behavior: viewport.reducedMotion === 'reduce' ? 'instant' : 'smooth',
			})
			await noHorizontalOverflow(page)
			await snapshot(page, info, `back-top-${theme}-${viewport.width}`)
		})
	}
}

test('back to top uses scroll restoration events and hysteresis without stealing unrelated focus', async ({
	page,
}) => {
	await page.setViewportSize({ width: 641, height: 390 })
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await observeScroll(page)
	await home(page, { panel: scrollablePanel })
	const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
	const arrow = tools.getByRole('button', { name: '回到顶部', exact: true })
	await page.evaluate(() => {
		let previous = false
		new MutationObserver(() => {
			const shown = !!document.querySelector('.home-scroll-top')
			if (shown !== previous) window.homeLayoutScrollProbe.visibility.push(shown)
			previous = shown
		}).observe(document.querySelector('.home-tools')!, { childList: true, subtree: true })
	})
	for (const [top, shown] of [
		[300, false],
		[320, false],
		[321, true],
		[319, true],
		[300, true],
		[241, true],
		[240, false],
		[260, false],
		[320, false],
		[321, true],
		[350, true],
		[310, true],
		[241, true],
		[240, false],
	] as const) {
		await nativeScroll(page, top)
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(top)
		await expect(arrow).toHaveCount(shown ? 1 : 0)
	}
	expect(await page.evaluate(() => window.homeLayoutScrollProbe.visibility)).toEqual([
		true,
		false,
		true,
		false,
	])
	await nativeScroll(page, 700)
	await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
	await expect(arrow).toBeVisible()
	await page.setViewportSize({ width: 700, height: 390 })
	await expect(arrow).toBeVisible()
	await arrow.focus()
	await nativeScroll(page, 200)
	await expect(arrow).toHaveCount(0)
	await expect(tools.getByRole('button', { name: '外网', exact: true })).toBeFocused()
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
	await nativeScroll(page, 700)
	await expect(arrow).toBeVisible()
	const search = page.getByRole('textbox', { name: '搜索', exact: true })
	await search.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }))
	await nativeScroll(page, 200)
	await expect(arrow).toHaveCount(0)
	await expect(search).toBeFocused()
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(200)
})

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 320, height: 640 },
	{ width: 641, height: 390 },
]) {
	test(`public visitors can return to top beside their single login action at ${viewport.width}×${viewport.height}`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport)
		await page.emulateMedia({ reducedMotion: 'reduce' })
		await observeScroll(page)
		await home(page, {
			visitor: true,
			panel: { ...scrollablePanel, netModeChangeButtonShow: false, searchBoxShow: false },
		})
		const tools = page.getByRole('navigation', { name: '首页工具', exact: true })
		const arrow = tools.getByRole('button', { name: '回到顶部', exact: true })
		await expect(tools.getByRole('button')).toHaveCount(1)
		await expect(arrow).toHaveCount(0)
		const original = await fixedActionBoxes(page)
		await nativeScroll(page, 'bottom')
		await expect(tools.getByRole('button')).toHaveCount(2)
		await expect(arrow).toBeVisible()
		await bottomTools(page, 1)
		await expectFixedActions(page, original)
		await expect(tools.getByRole('button', { name: '登录', exact: true })).toBeVisible()
		await expect(page.locator('.group-actions')).toHaveCount(0)
		await arrow.focus()
		await page.keyboard.press('Enter')
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
		await expect(page.locator('.home-logo-text')).toBeFocused()
		await expect(arrow).toHaveCount(0)
		await expect(tools.getByRole('button')).toHaveCount(1)
		await tools.getByRole('button', { name: '登录', exact: true }).click()
		await expect(page).toHaveURL(/\/login/)
	})
}
