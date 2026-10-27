import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function fixture(page: Page, monitors = false, theme: 'light' | 'dark' = 'light') {
	await page.addInitScript(
		(theme) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: 'optional-module-fixture',
						accounts: [],
						language: 'zh-CN',
						theme,
						network: 'wan',
						homeEditHintDismissed: true,
					},
				}),
			),
		theme,
	)
	const writes: string[] = []
	await page.route('**/api/**', (route) => {
		const path = new URL(route.request().url()).pathname
		let data: unknown = null
		if (path === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		else if (path === '/api/user/getAuthInfo') data = { user: { id: 8500, role: 2 }, visitMode: 0 }
		else if (path === '/api/panel/userConfig/get')
			data = {
				panel: {
					logoText: 'Module test home',
					footerHtml: '',
					clockShowSecond: true,
					systemMonitorShow: monitors,
				},
			}
		else if (path === '/api/panel/itemIconGroup/getNavigation')
			data = [
				{
					id: 8500,
					title: 'Module test group',
					items: ['First app', 'Second app'].map((title, index) => ({
						id: 8501 + index,
						title,
						url: '/favicon.svg',
						openMethod: 2,
						icon: { itemType: 1, text: 'M' },
					})),
				},
			]
		else if (path === '/api/system/moduleConfig/getByName') {
			if (monitors && route.request().postDataJSON().name === 'module-systemMonitor')
				data = { list: [{ key: 'cpu', monitorType: 'cpu', description: 'Module CPU' }] }
		} else if (path === '/api/system/monitor/getCpuState') data = { usages: [12.5], coreCount: 1 }
		else writes.push(path)
		return route.fulfill({ json: { code: 0, data } })
	})
	return writes
}

test('a real monitor chunk 404 keeps navigation available and can be dismissed or refreshed', async ({
	page,
}) => {
	const writes = await fixture(page, true)
	let requests = 0
	await page.route('**/assets/MonitorCards-*.js', (route) => {
		requests++
		return requests === 1
			? route.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing test chunk' })
			: route.continue()
	})
	const pageErrors: string[] = []
	page.on('pageerror', (error) => pageErrors.push(error.message))
	await page.goto('/#/')
	const failure = page.getByRole('alert').filter({ hasText: '页面功能加载失败' })
	const app = page.getByRole('link', { name: 'First app', exact: true })
	await expect(failure).toBeVisible()
	expect(await failure.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
		'rgba(0, 0, 0, 0)',
	)
	await expect(app).toBeVisible()
	await expect(app).toHaveAttribute('aria-disabled', 'false')
	await expect(page.locator('.home-page .clock time')).toBeVisible()
	await failure.getByRole('button', { name: '取消', exact: true }).click()
	await expect(failure).toHaveCount(0)
	await expect(page.locator('.home-page .home-logo-text')).toBeFocused()
	await expect(app).toHaveAttribute('href', '/favicon.svg')
	// A route remount still sees React.lazy's cached rejection until a full refresh.
	await page.evaluate(() => {
		location.hash = '/login'
	})
	await expect(page.locator('.login-page')).toBeVisible()
	await page.evaluate(() => {
		location.hash = '/'
	})
	await expect(failure).toBeVisible()
	expect(requests).toBe(1)
	await Promise.all([
		page.waitForNavigation(),
		failure.getByRole('button', { name: '刷新页面', exact: true }).click(),
	])
	await expect(page.locator('.monitor-card').filter({ hasText: 'Module CPU' })).toContainText('12.5')
	await expect(failure).toHaveCount(0)
	await expect(app).toBeVisible()
	expect(requests).toBe(2)
	expect(writes).toEqual([])
	expect(pageErrors).toEqual([])
})

for (const feature of ['menu', 'editor', 'sorting'] as const) {
	for (const view of [
		{ name: 'desktop-light', theme: 'light' as const, viewport: { width: 1440, height: 1000 } },
		{ name: 'phone-dark', theme: 'dark' as const, viewport: { width: 320, height: 640 } },
	]) {
		test(`a real ${feature} chunk 404 stays local and recovers by refresh in ${view.name}`, async ({
			page,
		}, info) => {
			await page.setViewportSize(view.viewport)
			const writes = await fixture(page, false, view.theme)
			const module = { menu: 'ItemActionMenu', editor: 'ItemEditor', sorting: 'Sortable' }[feature]
			let requests = 0
			await page.route(`**/assets/${module}-*.js`, (route) => {
				requests++
				if (requests === 1)
					return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Missing test chunk' })
				return route.continue()
			})
			const pageErrors: string[] = []
			page.on('pageerror', (error) => pageErrors.push(error.message))
			await page.goto('/#/')
			const app = page.getByRole('link', { name: 'First app', exact: true })
			const add = page.getByRole('button', { name: 'Module test group 添加项目', exact: true })
			const sort = page.getByRole('button', { name: 'Module test group 排序', exact: true })
			const trigger = feature === 'menu' ? app : feature === 'editor' ? add : sort
			const open = async () => {
				if (feature === 'menu') {
					await app.focus()
					await page.keyboard.press('Shift+F10')
				} else await trigger.click()
			}
			await expect(app).toBeVisible()
			await open()
			const failure = page.getByRole('alert').filter({ hasText: '页面功能加载失败' })
			await expect(failure).toBeVisible()
			if (feature === 'sorting')
				expect(await failure.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
					'rgba(0, 0, 0, 0)',
				)
			await expect(failure).toContainText('请刷新页面以重新加载。')
			await expect(page.locator('.home-page .home-logo-text')).toHaveText('Module test home')
			await expect(page.locator('.home-page .clock time')).toBeVisible()
			await expect(app).toBeVisible()
			await expect(page.getByRole('link', { name: 'Second app', exact: true })).toBeVisible()
			await expect(page.getByText('页面发生错误', { exact: true })).toHaveCount(0)
			await expect(failure.getByRole('button', { name: '取消', exact: true })).toBeVisible()
			await expect(page.locator('html')).toHaveAttribute('data-theme', view.theme)
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
			await failure.getByRole('button', { name: '取消', exact: true }).click({ trial: true })
			await page.screenshot({
				path: info.outputPath(`${feature}-failure-${view.name}.png`),
				animations: 'disabled',
			})
			await failure.getByRole('button', { name: '取消', exact: true }).click()
			await expect(failure).toHaveCount(0)
			await expect(trigger).toBeFocused()
			await expect(app).toHaveAttribute('aria-disabled', 'false')
			await expect(page.locator('.app-grid[inert], .item-action-popup, .drag-handle')).toHaveCount(0)
			await expect(app).toHaveAttribute('href', '/favicon.svg')
			expect(writes).toEqual([])
			if (feature !== 'sorting') {
				for (const dismissal of ['Escape', 'close'] as const) {
					await open()
					await expect(failure).toBeVisible()
					if (dismissal === 'Escape') await page.keyboard.press('Escape')
					else
						await page
							.getByRole('dialog')
							.getByRole('button', { name: /^(关闭|Close)$/ })
							.click()
					await expect(failure).toHaveCount(0)
					await expect(trigger).toBeFocused()
				}
			}

			// React.lazy caches this rejection. Reopening offers an honest refresh action
			// and must not imply that resetting the boundary downloaded a new module.
			await open()
			await expect(failure).toBeVisible()
			expect(requests).toBe(1)
			await Promise.all([
				page.waitForNavigation(),
				failure.getByRole('button', { name: '刷新页面', exact: true }).click(),
			])
			await expect(app).toBeVisible()
			await expect(failure).toHaveCount(0)
			await open()
			if (feature === 'menu') {
				await expect(page.getByRole('menu')).toBeVisible()
				await page.keyboard.press('Escape')
			} else if (feature === 'editor') {
				await expect(page.getByRole('dialog').getByLabel('标题', { exact: true })).toBeVisible()
				await page.getByRole('button', { name: '取消', exact: true }).click()
			} else {
				await expect(page.locator('.drag-handle')).toHaveCount(2)
				await page.getByRole('button', { name: 'Module test group 完成', exact: true }).click()
			}
			expect(requests).toBe(2)
			expect(writes).toEqual([])
			expect(pageErrors).toEqual([])
		})
	}
}
