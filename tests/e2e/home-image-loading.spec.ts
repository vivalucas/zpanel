import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const image = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
	'base64',
)

async function fixture(page: Page, icons: { title: string; src: string }[]) {
	const webp = Buffer.from(
		await page.evaluate(() => {
			const canvas = document.createElement('canvas')
			canvas.width = canvas.height = 1
			canvas.getContext('2d')!.fillRect(0, 0, 1, 1)
			return canvas.toDataURL('image/webp').split(',')[1]
		}),
		'base64',
	)
	const state = {
		requests: [] as string[],
		savedSrc: '',
		items: icons.map((icon, index) => ({
			id: 9301 + index,
			title: icon.title,
			url: '/favicon.svg',
			itemIconGroupId: 9300,
			openMethod: 2,
			icon: { itemType: 2, src: icon.src },
		})),
	}
	await page.addInitScript(() => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'home-image-fixture',
					accounts: [],
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
					homeEditHintDismissed: true,
				},
			}),
		)
	})
	await page.route('**/api/**', (route) => {
		const path = new URL(route.request().url()).pathname
		let data: unknown = null
		if (path === '/api/user/getAuthInfo') data = { user: { id: 9300, role: 2 }, visitMode: 0 }
		if (path === '/api/openness/loginConfig') data = { loginCaptcha: false, siteSetting: {} }
		if (path === '/api/panel/userConfig/get') data = { panel: { logoText: 'Image home', footerHtml: '' } }
		if (path === '/api/panel/itemIconGroup/getNavigation')
			data = [{ id: 9300, title: 'Image group', items: state.items }]
		if (path === '/api/panel/itemIcon/edit') {
			const changed = route.request().postDataJSON()
			state.savedSrc = changed.icon.src
			state.items = state.items.map((item) => (item.id === changed.id ? { ...item, ...changed } : item))
		}
		return route.fulfill({ json: { code: 0, data } })
	})
	await page.route('**/home-image-*', (route) => {
		const url = new URL(route.request().url())
		state.requests.push(url.href)
		if (url.pathname.includes('missing') || (url.pathname.includes('retry') && url.search))
			return route.fulfill({ status: 500 })
		return route.fulfill(
			url.pathname.endsWith('.webp')
				? { contentType: 'image/webp', body: webp }
				: { contentType: 'image/png', body: image },
		)
	})
	return state
}

test('home uses upload thumbnails while preserving WebP, remote, vector, animated and versioned URLs', async ({
	page,
	baseURL,
}, info) => {
	const icons = [
		{ title: 'Local icon', src: '/uploads/home-image-local.png' },
		{ title: 'Absolute icon', src: new URL('/uploads/home-image-absolute.jpg', baseURL).href },
		{ title: 'Remote icon', src: 'https://icons.example/uploads/home-image-remote.png' },
		{ title: 'Vector icon', src: '/uploads/home-image-vector.svg' },
		{ title: 'Animated icon', src: '/uploads/home-image-animated.gif' },
		{ title: 'Versioned icon', src: '/uploads/home-image-versioned.png?version=2' },
		{ title: 'WebP icon', src: '/uploads/home-image-original.webp' },
	]
	const state = await fixture(page, icons)
	await page.goto('/#/')
	for (const [index, icon] of icons.entries()) {
		const expectedSrc = index < 2 ? `${icon.src}?thumbnail=1` : icon.src
		const rendered = page.getByRole('link', { name: icon.title, exact: true }).locator('.item-icon img')
		await expect(rendered).toHaveAttribute('src', expectedSrc)
		await expect(rendered).toHaveAttribute('loading', 'lazy')
		await expect(rendered).toHaveAttribute('decoding', 'async')
		await expect.poll(() => rendered.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1)
		await expect.poll(() => state.requests.includes(new URL(expectedSrc, baseURL).href)).toBe(true)
	}
	expect(state.requests).not.toContain(new URL(icons[0].src, baseURL).href)
	expect(state.requests).not.toContain(icons[1].src)
	await page.screenshot({ path: info.outputPath('home-display-images.png'), animations: 'disabled' })
})

test('a failed home thumbnail retries its original and a failed original falls back to text', async ({
	page,
	baseURL,
}) => {
	const state = await fixture(page, [
		{ title: 'Retry icon', src: '/uploads/home-image-retry.png' },
		{ title: 'Missing icon', src: '/uploads/home-image-missing.png' },
	])
	await page.goto('/#/')
	const retry = page.getByRole('link', { name: 'Retry icon', exact: true }).locator('.item-icon img')
	await expect(retry).toHaveAttribute('src', '/uploads/home-image-retry.png')
	await expect.poll(() => retry.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1)
	const missing = page.getByRole('link', { name: 'Missing icon', exact: true }).locator('.item-icon')
	await expect(missing.locator('img')).toHaveCount(0)
	await expect(missing).toHaveText('MI')
	for (const name of ['retry', 'missing']) {
		const original = new URL(`/uploads/home-image-${name}.png`, baseURL).href
		expect(state.requests.filter((url) => url === `${original}?thumbnail=1`)).toHaveLength(1)
		expect(state.requests.filter((url) => url === original)).toHaveLength(1)
	}
})

test('icon editing keeps original URLs and changing a failed icon resets its display fallback', async ({
	page,
}) => {
	const state = await fixture(page, [{ title: 'Editable icon', src: '/uploads/home-image-missing.png' }])
	await page.goto('/#/')
	const link = page.getByRole('link', { name: 'Editable icon', exact: true })
	await expect(link.locator('.item-icon')).toHaveText('ED')
	await link.click({ button: 'right' })
	await page.getByRole('menuitem', { name: '编辑', exact: true }).click()
	const source = page.getByLabel('输入图标地址或上传', { exact: true })
	await expect(source).toHaveValue('/uploads/home-image-missing.png')
	await source.fill('/uploads/home-image-replaced.png')
	await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click()
	await expect(page.getByRole('dialog')).toHaveCount(0)
	expect(state.savedSrc).toBe('/uploads/home-image-replaced.png')
	await expect(link.locator('.item-icon img')).toHaveAttribute(
		'src',
		'/uploads/home-image-replaced.png?thumbnail=1',
	)
	await expect
		.poll(() => link.locator('.item-icon img').evaluate((element: HTMLImageElement) => element.naturalWidth))
		.toBe(1)
})
