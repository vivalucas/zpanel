import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

type Language = 'zh-CN' | 'en-US'
type Mode = 'add' | 'edit'
type IconType = 1 | 2 | 3
interface Scenario {
	mode: Mode
	iconType: IconType
	language: Language
	theme: 'light' | 'dark'
}

const names = {
	'zh-CN': {
		add: '添加项目',
		edit: '编辑',
		title: '标题',
		group: '分组',
		url: '地址',
		lan: '内网地址',
		description: '描述信息',
		method: '打开方式',
		type: '图标类型',
		text: '文字图标',
		image: '图片图标',
		source: '输入图标地址或上传',
		iconName: '请输入图标名称',
		background: '图标背景色',
		upload: '本地上传',
		getIcon: '获取图标',
		cancel: '取消',
		confirm: '确定',
	},
	'en-US': {
		add: 'Add item',
		edit: 'Edit',
		title: 'Title',
		group: 'Group',
		url: 'URL',
		lan: 'LAN URL',
		description: 'Description',
		method: 'Open method',
		type: 'Icon type',
		text: 'Text icon',
		image: 'Image icon',
		source: 'Enter icon URL or upload an image',
		iconName: 'Enter icon name',
		background: 'Icon background',
		upload: 'Local upload',
		getIcon: 'Get icon',
		cancel: 'Cancel',
		confirm: 'OK',
	},
}
let fixture = 0

async function openEditor(page: Page, scenario: Scenario) {
	const { mode, iconType, language, theme } = scenario
	const labels = names[language]
	let writes = 0
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
	await page.addInitScript(() => {
		// Every reload derives its preferences from that document, regardless of init-script order.
		const params = new URLSearchParams(location.search)
		localStorage.setItem(
			'zpanel-preferences',
			JSON.stringify({
				version: 1,
				state: {
					token: 'editor-layout-fixture',
					accounts: [],
					language: params.get('editorLanguage') || 'zh-CN',
					theme: params.get('editorTheme') || 'light',
					network: 'wan',
					homeEditHintDismissed: true,
				},
			}),
		)
	})
	await page.route('**/api/openness/loginConfig', (route) =>
		route.fulfill({ json: { code: 0, data: { loginCaptcha: false, siteSetting: {} } } }),
	)
	await page.route('**/api/user/getAuthInfo', (route) =>
		route.fulfill({ json: { code: 0, data: { user: { id: 410, role: 2 }, visitMode: 0 } } }),
	)
	await page.route('**/api/panel/userConfig/get', (route) =>
		route.fulfill({
			json: { code: 0, data: { panel: { marginTop: 0, searchBoxShow: false }, panelWarnings: [] } },
		}),
	)
	await page.route('**/api/panel/itemIconGroup/getNavigation', (route) =>
		route.fulfill({
			json: {
				code: 0,
				data: [
					{
						id: 4100,
						title: 'Editor group',
						items: [
							{
								id: 4101,
								itemIconGroupId: 4100,
								title: 'Layout editor app',
								url: 'https://example.test/app',
								lanUrl: 'https://lan.example.test/app',
								description: 'A saved application description.',
								openMethod: 2,
								icon: {
									itemType: iconType,
									text: iconType === 3 ? 'mdi:server' : 'Z',
									src: '/editor-layout-icon.svg',
									backgroundColor: '#eef0ff',
								},
							},
						],
					},
				],
			},
		}),
	)
	await page.route('**/api/system/moduleConfig/getByName', (route) =>
		route.fulfill({ json: { code: 0, data: null } }),
	)
	await page.route('**/api/panel/itemIcon/edit', (route) => {
		writes++
		return route.fulfill({ json: { code: 0, data: null } })
	})
	await page.route('**/editor-layout-icon.svg', (route) =>
		route.fulfill({
			contentType: 'image/svg+xml',
			body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="18" fill="#5266eb"/></svg>',
		}),
	)
	await page.route('https://api.iconify.design/**', (route) =>
		route.fulfill({
			json: {
				prefix: 'mdi',
				icons: { server: { body: '<path d="M4 4h16v6H4zm0 10h16v6H4z"/>' } },
				width: 24,
				height: 24,
			},
		}),
	)
	await page.goto(`/?editorLayoutFixture=${++fixture}&editorLanguage=${language}&editorTheme=${theme}#/`)
	await expect(page.locator('html')).toHaveAttribute('lang', language)
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
	if (mode === 'add')
		await page.getByRole('button', { name: `Editor group ${labels.add}`, exact: true }).click()
	else {
		await page.getByRole('link', { name: 'Layout editor app', exact: true }).click({ button: 'right' })
		await page.getByRole('menuitem', { name: labels.edit, exact: true }).click()
	}
	const dialog = page.locator('.item-editor-modal')
	await expect(dialog).toBeVisible()
	if (mode === 'add' && iconType !== 1) {
		await dialog.getByRole('combobox', { name: labels.type, exact: true }).click()
		await page
			.locator('.ant-select-dropdown:visible')
			.getByText(iconType === 2 ? labels.image : 'Iconify', { exact: true })
			.click()
		await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0)
	}
	await page.evaluate(async () => {
		await document.fonts.ready
	})
	const body = dialog.locator('.item-editor-body')
	const header = dialog.locator('.item-editor-header')
	const footer = dialog.locator('.item-editor-footer')
	const save = footer.getByRole('button', { name: labels.confirm, exact: true })
	return { dialog, body, header, footer, save, labels, writes: () => writes }
}

async function expectNoHorizontalOverflow(page: Page, dialog: Locator, body: Locator) {
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
	for (const region of [dialog, body])
		expect(await region.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(
			1,
		)
}

async function expectFields(editor: Awaited<ReturnType<typeof openEditor>>, iconType: IconType) {
	const { dialog, labels } = editor
	for (const name of [labels.title, labels.url, labels.lan, labels.description, labels.background])
		await expect(dialog.getByRole('textbox', { name, exact: true })).toBeVisible()
	for (const name of [labels.group, labels.method, labels.type])
		await expect(dialog.getByRole('combobox', { name, exact: true })).toBeVisible()
	const content = iconType === 1 ? labels.text : iconType === 2 ? labels.source : labels.iconName
	await expect(dialog.getByRole('textbox', { name: content, exact: true })).toBeVisible()
	if (iconType === 2) {
		await expect(dialog.getByRole('button', { name: labels.upload, exact: true })).toBeVisible()
		await expect(dialog.getByRole('button', { name: labels.getIcon, exact: true })).toBeVisible()
	}
}

async function dismissEditor(editor: Awaited<ReturnType<typeof openEditor>>, dirty: boolean) {
	const { dialog, labels } = editor
	await dialog
		.locator('.item-editor-footer')
		.getByRole('button', { name: labels.cancel, exact: true })
		.click()
	if (dirty) {
		const confirmation = dialog.page().locator('.ant-modal-confirm')
		await expect(confirmation).toBeVisible()
		await confirmation.getByRole('button', { name: labels.confirm, exact: true }).click()
	}
	await expect(dialog).toHaveCount(0)
}

const desktopSizes = [
	{ width: 1440, height: 900 },
	{ width: 1470, height: 740 },
	{ width: 1470, height: 780 },
	{ width: 1280, height: 720 },
]

for (const [sizeIndex, viewport] of desktopSizes.entries()) {
	test(`desktop ${viewport.width}x${viewport.height}: add and edit keep all three icon forms on one screen`, async ({
		page,
	}, info) => {
		test.setTimeout(60_000)
		await page.setViewportSize(viewport)
		for (const [modeIndex, mode] of (['add', 'edit'] as const).entries()) {
			for (const iconType of [1, 2, 3] as const) {
				const language = (sizeIndex + modeIndex + iconType) % 2 ? 'zh-CN' : 'en-US'
				const theme = (sizeIndex + modeIndex + Math.floor(iconType / 2)) % 2 ? 'dark' : 'light'
				const editor = await openEditor(page, { mode, iconType, language, theme })
				await expectFields(editor, iconType)
				await expectNoHorizontalOverflow(page, editor.dialog, editor.body)
				expect(
					await editor.body.evaluate((element) => element.scrollHeight - element.clientHeight),
				).toBeLessThanOrEqual(1)
				for (const label of await editor.body.locator('.ant-form-item-label').all())
					await expect(label).toBeInViewport({ ratio: 1 })
				const controls = editor.body
					.getByRole('textbox')
					.or(editor.body.getByRole('combobox'))
					.or(editor.body.getByRole('button'))
				for (const control of await controls.all()) {
					await expect(control).toBeInViewport({ ratio: 1 })
					await control.click({ trial: true })
				}
				await expect(editor.save).toBeInViewport({ ratio: 1 })
				await editor.save.click({ trial: true })
				expect(await editor.body.evaluate((element) => element.scrollTop)).toBe(0)
				expect(editor.writes()).toBe(0)
				if (mode === 'edit' && iconType === 2)
					await page.screenshot({
						path: info.outputPath(`editor-${viewport.width}x${viewport.height}-${language}-${theme}.png`),
						animations: 'disabled',
					})
				await dismissEditor(editor, mode === 'add' && iconType !== 1)
			}
		}
	})
}

for (const [sizeIndex, width] of [320, 390].entries()) {
	test(`narrow ${width}px: scrolling image forms keep their header and save actions fixed`, async ({
		page,
	}, info) => {
		await page.setViewportSize({ width, height: 640 })
		for (const [modeIndex, mode] of (['add', 'edit'] as const).entries()) {
			const language = (sizeIndex + modeIndex) % 2 ? 'en-US' : 'zh-CN'
			const theme = modeIndex ? 'dark' : 'light'
			const editor = await openEditor(page, { mode, iconType: 2, language, theme })
			await expectFields(editor, 2)
			await expectNoHorizontalOverflow(page, editor.dialog, editor.body)
			await expect(editor.header).toBeInViewport({ ratio: 1 })
			await expect(editor.footer).toBeInViewport({ ratio: 1 })
			await expect(editor.save).toBeInViewport({ ratio: 1 })
			await editor.save.click({ trial: true })
			const headerBefore = await editor.header.boundingBox()
			const footerBefore = await editor.footer.boundingBox()
			expect(await editor.body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
			await editor.body.evaluate((element) => {
				element.scrollTop = element.scrollHeight
			})
			await expect.poll(() => editor.body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
			await expect(
				editor.dialog.getByRole('textbox', { name: editor.labels.background, exact: true }),
			).toBeInViewport({ ratio: 1 })
			expect(await editor.header.boundingBox()).toEqual(headerBefore)
			expect(await editor.footer.boundingBox()).toEqual(footerBefore)
			await editor.save.click({ trial: true })
			expect(editor.writes()).toBe(0)
			await page.screenshot({
				path: info.outputPath(`editor-${width}-${mode}-${language}-${theme}.png`),
				animations: 'disabled',
			})
			await dismissEditor(editor, mode === 'add')
		}
	})
}

test('intermediate widths keep English image forms and long failed-upload rows within the dialog', async ({
	page,
}, info) => {
	const filename = `editor-screenshot-${'long-unbroken-filename'.repeat(7)}.png`
	for (const width of [641, 700, 820]) {
		await page.setViewportSize({ width, height: 740 })
		const editor = await openEditor(page, {
			mode: 'edit',
			iconType: 2,
			language: 'en-US',
			theme: width === 700 ? 'dark' : 'light',
		})
		await expectFields(editor, 2)
		const expectActions = async () => {
			await expectNoHorizontalOverflow(page, editor.dialog, editor.body)
			await expect(editor.header).toBeInViewport({ ratio: 1 })
			await expect(editor.footer).toBeInViewport({ ratio: 1 })
			await editor.dialog.getByRole('button', { name: 'Close', exact: true }).click({ trial: true })
			await expect(editor.save).toBeEnabled()
			await expect(editor.save).toBeInViewport({ ratio: 1 })
			await editor.save.click({ trial: true })
		}
		await expectActions()
		if (width !== 700) {
			await page.route('**/api/file/uploadImg', (route) =>
				route.fulfill({ json: { code: 500, msg: 'Layout upload failure' } }),
			)
			await editor.body
				.locator('input[type=file]')
				.setInputFiles({ name: filename, mimeType: 'image/png', buffer: Buffer.from('layout-fixture') })
			const retry = editor.body.getByRole('button', { name: 'Retry', exact: true })
			await expect(retry).toBeEnabled()
			await expect(editor.body.locator('.upload-row')).toContainText(filename)
			await retry.scrollIntoViewIfNeeded()
			await expect(retry).toBeInViewport({ ratio: 1 })
			await retry.click({ trial: true })
			const headerBefore = await editor.header.boundingBox()
			const footerBefore = await editor.footer.boundingBox()
			await editor.body.evaluate((element) => {
				element.scrollTop = element.scrollHeight
			})
			await expectActions()
			expect(await editor.header.boundingBox()).toEqual(headerBefore)
			expect(await editor.footer.boundingBox()).toEqual(footerBefore)
			await page.screenshot({
				path: info.outputPath(`editor-upload-failure-${width}.png`),
				animations: 'disabled',
			})
		}
		expect(editor.writes()).toBe(0)
		await dismissEditor(editor, false)
	}
})

test('validation errors remain reachable by body scrolling while the save action stays usable', async ({
	page,
}, info) => {
	await page.setViewportSize({ width: 320, height: 480 })
	const editor = await openEditor(page, { mode: 'add', iconType: 2, language: 'en-US', theme: 'dark' })
	await editor.dialog
		.getByRole('textbox', { name: editor.labels.url, exact: true })
		.fill('javascript:alert(1)')
	await editor.dialog
		.getByRole('textbox', { name: editor.labels.source, exact: true })
		.fill('javascript:alert(2)')
	await editor.save.click()
	const errors = editor.body.locator('.ant-form-item-explain-error')
	await expect.poll(() => errors.count()).toBeGreaterThan(0)
	const headerBefore = await editor.header.boundingBox()
	const footerBefore = await editor.footer.boundingBox()
	for (const error of await errors.all()) {
		await error.scrollIntoViewIfNeeded()
		await expect(error).toBeInViewport({ ratio: 1 })
		await expect(editor.save).toBeInViewport({ ratio: 1 })
		await editor.save.click({ trial: true })
	}
	await expectNoHorizontalOverflow(page, editor.dialog, editor.body)
	expect(await editor.header.boundingBox()).toEqual(headerBefore)
	expect(await editor.footer.boundingBox()).toEqual(footerBefore)
	expect(editor.writes()).toBe(0)
	await page.screenshot({ path: info.outputPath('editor-validation-320x480.png'), animations: 'disabled' })
	await dismissEditor(editor, true)
})
