import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

let admin: { token: string; id: number; name: string }

function gate() {
	let release!: () => void
	const pending = new Promise<void>((resolve) => {
		release = resolve
	})
	return { pending, release }
}

async function enter(page: Page, section: string) {
	await page.addInitScript(
		(user) =>
			localStorage.setItem(
				'zpanel-preferences',
				JSON.stringify({
					version: 1,
					state: {
						token: user.token,
						accounts: [{ token: user.token, user }],
						theme: 'light',
						language: 'zh-CN',
						network: 'wan',
					},
				}),
			),
		admin,
	)
	await page.goto(`/#/settings/${section}`)
}

test.beforeAll(async ({ request }) => {
	const result = await (
		await request.post('/api/login', {
			data: { username: 'admin@zpanel.local', password: '12345678' },
		})
	).json()
	expect(result.code).toBe(0)
	admin = result.data
})

test('duplicate search URLs retain the selected engine and failed saves retain the draft', async ({
	page,
}) => {
	const engines = [
		{ title: 'Alpha', url: 'https://example.com/search?q=%s', iconSrc: '/favicon.svg?alpha' },
		{ title: 'Beta', url: 'https://example.com/search?q=%s', iconSrc: '/favicon.svg?beta' },
	]
	let saved = { searchEngineList: engines, currentSearchEngine: engines[1], newWindowOpen: true }
	let attempts = 0
	await page.route('**/api/system/moduleConfig/getByName', (route) => {
		if (route.request().postDataJSON().name !== 'module-deskModuleSearchBox') return route.continue()
		return route.fulfill({ json: { code: 0, data: saved } })
	})
	await page.route('**/api/system/moduleConfig/save', (route) => {
		const body = route.request().postDataJSON()
		expect(body.name).toBe('module-deskModuleSearchBox')
		expect(body.value.currentSearchEngine).toEqual(engines[1])
		attempts++
		if (attempts === 1) return route.fulfill({ json: { code: 1200 } })
		saved = body.value
		return route.fulfill({ json: { code: 0 } })
	})
	await enter(page, 'modules')
	const search = page.locator('.settings-section').first()
	const selected = page.locator('.ant-select').filter({ has: page.locator('#selected') })
	await expect(selected).toContainText('Beta')
	await page.locator('#searchEngineList_0_title').fill('Alpha draft')
	await search.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => attempts).toBe(1)
	await expect(search.locator('.settings-draft-hint')).toHaveText('有未保存的更改')
	await expect(page.locator('#searchEngineList_0_title')).toHaveValue('Alpha draft')
	await expect(selected).toContainText('Beta')
	await search.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => attempts).toBe(2)
	await expect(search.locator('.settings-draft-hint')).toHaveCount(0)
	await page.reload()
	await expect(selected).toContainText('Beta')
	await expect(page.locator('#searchEngineList_0_title')).toHaveValue('Alpha draft')
})

test('monitor colors stay collapsed and preserve complete CSS values through a failed save', async ({
	page,
}) => {
	let saved = {
		list: [
			{
				key: 'polish-cpu',
				monitorType: 'cpu',
				description: 'Polish monitor',
				extendParam: {
					progressColor: 'color(display-p3 1 0 0)',
					progressRailColor: 'rgba(20, 30, 40, 0.2)',
					color: 'var(--text)',
					backgroundColor: 'transparent',
				},
			},
		],
	}
	let attempts = 0
	await page.route('**/api/system/moduleConfig/getByName', (route) => {
		if (route.request().postDataJSON().name !== 'module-systemMonitor') return route.continue()
		return route.fulfill({ json: { code: 0, data: saved } })
	})
	await page.route('**/api/system/moduleConfig/save', (route) => {
		const body = route.request().postDataJSON()
		expect(body.name).toBe('module-systemMonitor')
		attempts++
		if (attempts === 1) return route.fulfill({ json: { code: 1200 } })
		saved = body.value
		return route.fulfill({ json: { code: 0 } })
	})
	await enter(page, 'modules')
	const monitor = page.locator('.settings-section').nth(1)
	const advanced = monitor.locator('details')
	await expect(advanced).not.toHaveAttribute('open')
	await expect(page.locator('#list_0_extendParam_progressColor')).not.toBeVisible()
	await advanced.locator('summary').click()
	const color = page.locator('#list_0_extendParam_progressColor')
	await expect(color).toHaveValue('color(display-p3 1 0 0)')
	await expect(advanced.locator('.color-preview')).toHaveCount(4)
	const cssColor = 'color-mix(in srgb, red 25%, transparent)'
	await color.fill(cssColor)
	await advanced.locator('summary').click()
	await monitor.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => attempts).toBe(1)
	await expect(monitor.locator('.settings-draft-hint')).toHaveText('有未保存的更改')
	await monitor.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => attempts).toBe(2)
	await expect(monitor.locator('.settings-draft-hint')).toHaveCount(0)
	expect(saved.list[0].extendParam).toEqual({
		progressColor: cssColor,
		progressRailColor: 'rgba(20, 30, 40, 0.2)',
		color: 'var(--text)',
		backgroundColor: 'transparent',
	})
})

for (const kind of ['search', 'monitors'] as const) {
	test(`${kind} keeps the saved configuration when its follow-up refresh fails`, async ({ page }) => {
		const engines = [
			{ title: 'Alpha', url: 'https://example.com/alpha?q=%s', iconSrc: '/favicon.svg?alpha' },
			{ title: 'Beta', url: 'https://example.com/beta?q=%s', iconSrc: '/favicon.svg?beta' },
		]
		const initial =
			kind === 'search'
				? { searchEngineList: engines, currentSearchEngine: engines[1], newWindowOpen: true }
				: {
						list: [
							{
								key: 'saved-monitor',
								monitorType: 'cpu',
								description: 'Original monitor',
								extendParam: {
									progressColor: 'color(display-p3 1 0 0)',
									progressRailColor: 'rgba(20, 30, 40, 0.2)',
									color: 'var(--text)',
									backgroundColor: 'transparent',
								},
							},
						],
					}
		const moduleName = kind === 'search' ? 'module-deskModuleSearchBox' : 'module-systemMonitor'
		const attempts: unknown[] = []
		await page.route('**/api/system/moduleConfig/getByName', (route) => {
			if (route.request().postDataJSON().name !== moduleName) return route.continue()
			return route.fulfill({ json: attempts.length ? { code: 1200 } : { code: 0, data: initial } })
		})
		await page.route('**/api/system/moduleConfig/save', (route) => {
			const body = route.request().postDataJSON()
			expect(body.name).toBe(moduleName)
			attempts.push(body.value)
			return route.fulfill({ json: { code: 0 } })
		})
		await enter(page, 'modules')
		const section = page.locator('.settings-section').nth(kind === 'search' ? 0 : 1)
		const field = page.locator(kind === 'search' ? '#searchEngineList_1_title' : '#list_0_description')
		const savedTitle = kind === 'search' ? 'Saved Beta' : 'Saved monitor'
		await field.fill(savedTitle)
		if (kind === 'search') await page.locator('#newWindowOpen').click()
		const expected =
			kind === 'search'
				? {
						searchEngineList: [engines[0], { ...engines[1], title: savedTitle }],
						currentSearchEngine: { ...engines[1], title: savedTitle },
						newWindowOpen: false,
					}
				: { list: initial.list!.map((item) => ({ ...item, description: savedTitle })) }
		const save = section.getByRole('button', { name: '保存', exact: true })
		await save.click()
		await expect.poll(() => attempts.length).toBe(1)
		await expect(section.getByRole('alert')).toContainText('刷新失败')
		await expect(section.locator('.settings-draft-hint')).toHaveCount(0)
		await expect(save).toBeEnabled()
		await expect(field).toHaveValue(savedTitle)
		if (kind === 'search') {
			await expect(page.locator('#newWindowOpen')).toHaveAttribute('aria-checked', 'false')
			await expect(page.locator('.ant-select').filter({ has: page.locator('#selected') })).toContainText(
				savedTitle,
			)
		}
		expect(attempts[0]).toEqual(expected)
		// Another save must retain the acknowledged configuration instead of re-saving stale data.
		await save.click()
		await expect.poll(() => attempts.length).toBe(2)
		await expect(save).toBeEnabled()
		expect(attempts[1]).toEqual(expected)
	})
}

for (const kind of ['search', 'monitors', 'mountpoints'] as const) {
	test(`${kind} retains cached module data only for temporary failures and recovers after access retry`, async ({
		page,
	}) => {
		await page.clock.install()
		let failure: 'temporary' | 'access' | null = null
		const accessCode = kind === 'search' ? 401 : kind === 'monitors' ? 403 : 1006
		const engines = [{ title: 'Cached engine', url: 'https://example.com/?q=%s', iconSrc: '/favicon.svg' }]
		await page.route('**/api/system/moduleConfig/getByName', (route) => {
			const name = route.request().postDataJSON().name
			const target = name === (kind === 'search' ? 'module-deskModuleSearchBox' : 'module-systemMonitor')
			if (kind !== 'mountpoints' && target && failure)
				return route.fulfill({
					status: failure === 'access' ? accessCode : 200,
					json: { code: failure === 'access' ? accessCode : 1200 },
				})
			return route.fulfill({
				json: {
					code: 0,
					data:
						name === 'module-deskModuleSearchBox'
							? { searchEngineList: engines, currentSearchEngine: engines[0], newWindowOpen: true }
							: {
									list: [
										{
											key: 'cached-monitor',
											monitorType: kind === 'mountpoints' ? 'disk' : 'cpu',
											description: 'Cached monitor',
											extendParam: { path: '/audit/mount' },
										},
									],
								},
				},
			})
		})
		await page.route('**/api/system/monitor/getDiskMountpoints', (route) =>
			route.fulfill({
				json:
					kind === 'mountpoints' && failure
						? { code: failure === 'access' ? accessCode : 1200 }
						: { code: 0, data: [{ mountpoint: '/audit/mount', device: '/dev/audit' }] },
			}),
		)
		await page.route('**/api/system/moduleConfig/save', (route) => {
			failure = 'temporary'
			return route.fulfill({ json: { code: 0 } })
		})
		await enter(page, 'modules')
		const section = page.locator('.settings-section').nth(kind === 'search' ? 0 : 1)
		const other = page.locator('.settings-section').nth(kind === 'search' ? 1 : 0)
		const field = page.locator(kind === 'search' ? '#searchEngineList_0_title' : '#list_0_description')
		const expected = kind === 'search' ? 'Cached engine' : 'Cached monitor'
		await expect(field).toHaveValue(expected)
		if (kind === 'mountpoints') {
			await expect(
				page.locator('.ant-select').filter({ has: page.locator('#list_0_extendParam_path') }),
			).toContainText('/audit/mount')
			failure = 'temporary'
			await page.clock.fastForward(31_000)
			await page.getByRole('menuitem', { name: '关于', exact: true }).click()
			await page.getByRole('menuitem', { name: '搜索与监控', exact: true }).click()
		} else await section.getByRole('button', { name: '保存', exact: true }).click()
		await expect(section.getByRole('alert')).toBeVisible()
		await expect(field).toHaveValue(expected)
		await expect(section.getByRole('button', { name: '保存', exact: true })).toBeEnabled()
		failure = 'access'
		await section.getByRole('button', { name: '重试', exact: true }).click()
		await expect(section.locator('form')).toHaveCount(0)
		await expect(field).toHaveCount(0)
		await expect(other.locator('form')).toBeVisible()
		failure = null
		await section.getByRole('button', { name: '重试', exact: true }).click()
		await expect(field).toHaveValue(expected)
		await expect(section.getByRole('alert')).toHaveCount(0)
		await expect(section.getByRole('button', { name: '保存', exact: true })).toBeEnabled()
	})
}

for (const target of ['users', 'public-user'] as const) {
	test(`${target} retains cached users only for temporary failures and recovers after access retry`, async ({
		page,
	}) => {
		let failure: 'temporary' | 'access' | null = null
		await page.route('**/api/panel/users/getList', (route) =>
			route.fulfill({
				json:
					target === 'users' && failure
						? { code: failure === 'access' ? 1004 : 1200 }
						: {
								code: 0,
								data: {
									count: 1,
									list: [{ id: 7891, username: 'cached-user', name: 'Cached user', role: 2 }],
								},
							},
			}),
		)
		await page.route('**/api/panel/users/getPublicVisitUser', (route) =>
			route.fulfill({
				status: target === 'public-user' && failure === 'access' ? 403 : 200,
				json:
					target === 'public-user' && failure
						? { code: failure === 'access' ? 1005 : 1200 }
						: { code: 0, data: { id: 7891 } },
			}),
		)
		await page.route('**/api/panel/users/update', (route) => {
			failure = 'temporary'
			return route.fulfill({ json: { code: 0 } })
		})
		await enter(page, 'users')
		const row = page.getByRole('row').filter({ hasText: 'cached-user' })
		await row.getByRole('button', { name: '编辑', exact: true }).click()
		await page.getByRole('dialog').getByRole('button', { name: '确定', exact: true }).click()
		await expect(page.getByRole('dialog')).toHaveCount(0)
		await expect(page.locator('.settings-body').getByRole('alert')).toBeVisible()
		await expect(row).toBeVisible()
		failure = 'access'
		await page.locator('.settings-body').getByRole('button', { name: '重试', exact: true }).click()
		await expect(page.locator('.settings-body .ant-table')).toHaveCount(0)
		await expect(
			page.locator('.settings-body').getByRole('button', { name: '添加', exact: true }),
		).toHaveCount(0)
		failure = null
		await page.locator('.settings-body').getByRole('button', { name: '重试', exact: true }).click()
		await expect(row).toBeVisible()
		await expect(page.locator('.settings-body').getByRole('alert')).toHaveCount(0)
	})
}

for (const target of ['containers', 'stats'] as const) {
	test(`Docker ${target} retains cached data only for temporary failures and recovers after access retry`, async ({
		page,
	}) => {
		let failure: 'temporary' | 'access' | null = null
		await page.route('**/api/system/docker/containers', (route) =>
			route.fulfill({
				json:
					target === 'containers' && failure
						? { code: failure === 'access' ? 1005 : 1200 }
						: {
								code: 0,
								data: {
									count: 1,
									list: [
										{ id: 'audit-container', names: 'Cached container', image: 'audit', state: 'running' },
									],
								},
							},
			}),
		)
		await page.route('**/api/system/docker/stats', (route) =>
			route.fulfill({
				json:
					target === 'stats' && failure
						? { code: failure === 'access' ? 1006 : 1200 }
						: {
								code: 0,
								data: [{ ID: 'audit-container', CPUPerc: '17.25%', MemUsage: '100MiB', NetIO: '1kB' }],
							},
			}),
		)
		await enter(page, 'docker')
		const row = page.getByRole('row').filter({ hasText: 'Cached container' })
		await expect(row).toContainText('17.25%')
		failure = 'temporary'
		await page.getByRole('button', { name: '刷新', exact: true }).click()
		await expect(page.locator('.settings-body').getByRole('alert')).toBeVisible()
		await expect(row).toContainText('17.25%')
		failure = 'access'
		await page.locator('.settings-body').getByRole('button', { name: '重试', exact: true }).click()
		await expect(page.locator('.settings-body .ant-table')).toHaveCount(0)
		await expect(page.locator('.settings-body')).not.toContainText('17.25%')
		failure = null
		await page.locator('.settings-body').getByRole('button', { name: '重试', exact: true }).click()
		await expect(row).toContainText('17.25%')
		await expect(page.locator('.settings-body').getByRole('alert')).toHaveCount(0)
	})
}

test('late avatar uploads respect edits and a legacy nickname does not block profile saves', async ({
	page,
}) => {
	const upload = gate()
	let uploadStarted = false
	let attempts = 0
	await page.route('**/api/user/getAuthInfo', async (route) => {
		const response = await route.fetch()
		const result = await response.json()
		result.data.user.name = 'admin@zpanel.local'
		return route.fulfill({ response, json: result })
	})
	await page.route('**/api/file/uploadImg', async (route) => {
		uploadStarted = true
		await upload.pending
		return route.fulfill({ json: { code: 0, data: { imageUrl: '/favicon.svg?late-avatar', fileId: 899 } } })
	})
	await page.route('**/api/user/updateInfo', (route) => {
		attempts++
		expect(route.request().postDataJSON().headImage).toBe('/favicon.svg?original-avatar')
		expect(route.request().postDataJSON().name).toBe('admin@zpanel.local')
		return route.fulfill({ json: { code: attempts === 1 ? 1200 : 0 } })
	})
	await enter(page, 'account')
	const profile = page.locator('.settings-section').first()
	const avatar = page.getByLabel('头像地址', { exact: true })
	const nickname = page.getByLabel('昵称', { exact: true })
	await expect(nickname).toHaveValue('admin@zpanel.local')
	await avatar.fill('/favicon.svg?original-avatar')
	await page.locator('input[type=file]').setInputFiles({
		name: 'polish-avatar.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSkcAAAAASUVORK5CYII=',
			'base64',
		),
	})
	try {
		await expect.poll(() => uploadStarted).toBe(true)
		await expect(profile.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
		await avatar.fill('/favicon.svg?newer-avatar')
		await avatar.fill('/favicon.svg?original-avatar')
	} finally {
		upload.release()
	}
	await expect(profile.getByRole('button', { name: '保存', exact: true })).toBeEnabled()
	await expect(avatar).toHaveValue('/favicon.svg?original-avatar')
	await profile.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => attempts).toBe(1)
	await expect(profile.locator('.settings-draft-hint')).toHaveText('有未保存的更改')
	await expect(avatar).toHaveValue('/favicon.svg?original-avatar')
	await profile.getByRole('button', { name: '保存', exact: true }).click()
	await expect.poll(() => attempts).toBe(2)
	await expect(profile.locator('.settings-draft-hint')).toHaveCount(0)
	await nickname.fill('Changed nickname too long')
	await profile.getByRole('button', { name: '保存', exact: true }).click()
	await expect(nickname).toHaveAttribute('aria-invalid', 'true')
	expect(attempts).toBe(2)
})

test('empty image galleries show an upload hint without pagination', async ({ page }) => {
	await page.route('**/api/file/getList', (route) =>
		route.fulfill({ json: { code: 0, data: { list: [], count: 0 } } }),
	)
	await page.route('**/api/file/getPublicList', (route) =>
		route.fulfill({ json: { code: 0, data: { list: [], count: 0 } } }),
	)
	await enter(page, 'files')
	await expect(page.getByText('还没有图片，点击上方「本地上传」添加。')).toBeVisible()
	await expect(page.getByRole('button', { name: '本地上传', exact: true })).toBeVisible()
	await expect(page.locator('.ant-pagination')).toHaveCount(0)
	await page.getByRole('tab', { name: '公共图库', exact: true }).click()
	await expect(page.getByText('公共图库暂无图片。')).toBeVisible()
	await expect(page.locator('.ant-pagination')).toHaveCount(0)
})

test('mobile user operations remain visible before scrolling the table', async ({ page }, info) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.route('**/api/panel/users/getList', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: {
					count: 2,
					list: [
						{ id: admin.id, username: 'admin@zpanel.local', name: 'admin@zpanel.local', role: 1 },
						{ id: 989, username: 'polish-mobile-user', name: 'Mobile user', role: 2 },
					],
				},
			},
		}),
	)
	await enter(page, 'users')
	const row = page.getByRole('row').filter({ hasText: 'polish-mobile-user' })
	const edit = row.getByRole('button', { name: '编辑', exact: true })
	await expect(edit).toBeInViewport()
	await expect(row.getByRole('button', { name: '删除', exact: true })).toBeInViewport()
	expect(await page.locator('.ant-table-content').evaluate((el) => el.scrollLeft)).toBe(0)
	await edit.click()
	await expect(page.getByRole('dialog').getByLabel('昵称', { exact: true })).toHaveValue('Mobile user')
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /取.*消/ })
		.click()
	for (const width of [320, 390]) {
		await page.setViewportSize({ width, height: 844 })
		await expect(edit).toBeInViewport()
		const current = page.getByRole('row').filter({ hasText: '当前账号' })
		const bounds = await current.locator('.user-table-identity').evaluate((element) => {
			const name = element.children[0].getBoundingClientRect()
			const badge = element.children[1].getBoundingClientRect()
			return { separated: name.bottom <= badge.top, nameHeight: name.height, badgeHeight: badge.height }
		})
		expect(bounds.separated).toBeTruthy()
		expect(bounds.nameHeight).toBeGreaterThan(0)
		expect(bounds.badgeHeight).toBeGreaterThan(0)
		await page.screenshot({ path: info.outputPath(`users-${width}.png`), animations: 'disabled' })
	}
})

test('about sections show loading independently until their own response arrives', async ({ page }) => {
	const version = gate()
	const description = gate()
	await page.route('**/api/about', async (route) => {
		await version.pending
		return route.fulfill({ json: { code: 0, data: { versionName: 'polish-version' } } })
	})
	await page.route('**/api/openness/getAboutDescription', async (route) => {
		await description.pending
		return route.fulfill({ json: { code: 0, data: 'Polish description' } })
	})
	await enter(page, 'about')
	try {
		await expect(page.getByRole('status').filter({ hasText: '加载中' })).toBeVisible()
		await expect(page.locator('.loading-state')).toBeVisible()
		version.release()
		await expect(page.getByText('polish-version')).toBeVisible()
		await expect(page.locator('.loading-state')).toBeVisible()
	} finally {
		version.release()
		description.release()
	}
	await expect(page.getByText('Polish description', { exact: true })).toBeVisible()
	await expect(page.locator('.loading-state')).toHaveCount(0)
})
