import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

interface Write {
	path: string
	body: Record<string, unknown>
}

function gate() {
	let release!: () => void
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	return { pending, release }
}

async function enter(
	page: Page,
	section: string,
	onWrite: (write: Write) => Promise<{ code: number }> = async () => ({ code: 0 }),
) {
	const user = { id: 3401, name: 'Test user', username: 'navigation-test', role: 1 }
	await page.addInitScript((user) => {
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'auto-save-navigation',
					accounts: [{ token: 'auto-save-navigation', user }],
					theme: 'light',
					language: 'zh-CN',
					network: 'wan',
				},
			}),
		)
	}, user)
	await page.route('**/api/**', async (route) => {
		const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
		if (
			[
				'/panel/userConfig/set',
				'/system/moduleConfig/save',
				'/user/updateInfo',
				'/user/updatePassword',
			].includes(path)
		) {
			return route.fulfill({ json: await onWrite({ path, body: route.request().postDataJSON() }) })
		}
		let data: unknown
		switch (path) {
			case '/user/getAuthInfo':
				data = { user, visitMode: 0 }
				break
			case '/openness/loginConfig':
				data = { siteSetting: { siteTitle: 'Navigation test' }, loginCaptcha: false }
				break
			case '/panel/userConfig/get':
				data = { panel: {} }
				break
			case '/system/moduleConfig/getByName': {
				const engine = { title: 'Original engine', url: 'https://example.com/?q=%s', iconSrc: '' }
				data =
					route.request().postDataJSON().name === 'module-deskModuleSearchBox'
						? { searchEngineList: [engine], currentSearchEngine: engine, newWindowOpen: true }
						: { list: [{ key: 'navigation-cpu', monitorType: 'cpu', description: 'Original monitor' }] }
				break
			}
			case '/system/monitor/getDiskMountpoints':
				data = []
				break
			case '/about':
				data = { versionName: 'Navigation test' }
				break
			case '/openness/getAboutDescription':
				data = 'Navigation test'
				break
			default:
				return route.fulfill({ status: 404, json: { code: 404 } })
		}
		return route.fulfill({ json: { code: 0, data } })
	})
	await page.goto(`/#/settings/${section}`)
}

for (const section of ['appearance', 'modules', 'account'] as const) {
	test(`${section} waits for automatic saves before navigating without a discard dialog`, async ({
		page,
	}) => {
		const save = gate()
		const writes: Write[] = []
		await enter(page, section, async (write) => {
			writes.push(write)
			await save.pending
			return { code: 0 }
		})
		await page
			.locator(
				section === 'appearance'
					? '#logoText'
					: section === 'modules'
						? '#searchEngineList_0_title'
						: '#name',
			)
			.fill('Updated name')
		if (section === 'modules') await page.locator('#list_0_description').fill('Updated monitor')
		await page.getByRole('menuitem', { name: '关于', exact: true }).click()
		try {
			await expect.poll(() => writes.length).toBe(section === 'modules' ? 2 : 1)
			await expect(page).toHaveURL(new RegExp(`#/settings/${section}$`))
			await expect(page.getByRole('dialog')).toHaveCount(0)
		} finally {
			save.release()
		}
		await expect(page).toHaveURL(/#\/settings\/about$/)
		await expect(page.getByRole('dialog')).toHaveCount(0)
		if (section === 'modules')
			expect(writes.map((write) => write.body.name).sort()).toEqual([
				'module-deskModuleSearchBox',
				'module-systemMonitor',
			])
	})
}

test('a failed automatic save protects a pending navigation and can be retried', async ({ page }) => {
	let writes = 0
	await enter(page, 'appearance', async () => ({ code: ++writes === 1 ? 1200 : 0 }))
	await page.locator('#logoText').fill('Failed save')
	await page.getByRole('menuitem', { name: '关于', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toContainText('放弃未保存的修改并离开？')
	await expect(page).toHaveURL(/#\/settings\/appearance$/)
	expect(writes).toBe(1)
	await dialog.getByRole('button', { name: /取.*消/ }).click()
	await expect(page.locator('#logoText')).toHaveValue('Failed save')
	await page.locator('.auto-save-status').getByRole('button', { name: '重试', exact: true }).click()
	await expect(page.locator('.auto-save-status')).toHaveAttribute('data-save-status', 'saved')
	await page.getByRole('menuitem', { name: '关于', exact: true }).click()
	await expect(page).toHaveURL(/#\/settings\/about$/)
	await expect(dialog).toHaveCount(0)
	expect(writes).toBe(2)
})

test('an invalid search draft protects navigation even while another module saves', async ({ page }) => {
	const writes: Write[] = []
	await enter(page, 'modules', async (write) => {
		writes.push(write)
		return { code: 0 }
	})
	await page.locator('#searchEngineList_0_title').fill('')
	await page.locator('#list_0_description').fill('Updated monitor')
	await page.getByRole('menuitem', { name: '关于', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toContainText('放弃未保存的修改并离开？')
	await expect(page).toHaveURL(/#\/settings\/modules$/)
	await expect.poll(() => writes.length).toBe(1)
	expect(writes[0].body.name).toBe('module-systemMonitor')
	await dialog.getByRole('button', { name: /取.*消/ }).click()
	await expect(page.locator('#searchEngineList_0_title')).toHaveValue('')
	await expect(page.locator('#searchEngineList_0_title')).toHaveAttribute('aria-invalid', 'true')
})

test('password drafts keep their manual confirmation when profile details auto-save', async ({ page }) => {
	const writes: Write[] = []
	await enter(page, 'account', async (write) => {
		writes.push(write)
		return { code: 0 }
	})
	await page.locator('#oldPassword').fill('password draft')
	await page.locator('#name').fill('Updated name')
	await page.getByRole('menuitem', { name: '关于', exact: true }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toContainText('放弃未保存的修改并离开？')
	await expect(page).toHaveURL(/#\/settings\/account$/)
	await expect.poll(() => writes.length).toBe(1)
	expect(writes[0].path).toBe('/user/updateInfo')
	await dialog.getByRole('button', { name: /取.*消/ }).click()
	await expect(page.locator('#oldPassword')).toHaveValue('password draft')
})

test('an unfinished avatar upload keeps its navigation confirmation', async ({ page }) => {
	const upload = gate()
	let uploading = false
	await enter(page, 'account')
	await page.route('**/api/file/uploadImg', async (route) => {
		uploading = true
		await upload.pending
		return route.fulfill({ json: { code: 0, data: { imageUrl: '/favicon.svg?uploaded', fileId: 3402 } } })
	})
	await page.locator('input[type=file]').setInputFiles({
		name: 'navigation-avatar.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSkcAAAAASUVORK5CYII=',
			'base64',
		),
	})
	try {
		await expect.poll(() => uploading).toBe(true)
		await page.getByRole('menuitem', { name: '关于', exact: true }).click()
		const dialog = page.getByRole('dialog')
		await expect(dialog).toContainText('放弃未保存的修改并离开？')
		await dialog.getByRole('button', { name: /取.*消/ }).click()
		await expect(page).toHaveURL(/#\/settings\/account$/)
	} finally {
		upload.release()
	}
})
