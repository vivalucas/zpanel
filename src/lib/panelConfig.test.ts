import { describe, expect, it } from 'vitest'
import { isValidPanelConfig, sanitizePanelConfig } from './panelConfig'
import { passwordRule } from './password'
import { exportJson, importJsonString } from '@/utils/jsonImportExport'

describe('configuration and input boundaries', () => {
	it('rejects checksummed backups with invalid style fields', () => {
		for (const style of [
			{ iconTextColor: 42 },
			{ backgroundBlur: -1 },
			{ searchBoxShow: 'yes' },
			{ maxWidth: null },
			{ iconStyle: 3 },
		]) {
			const backup = exportJson('test')
				.addStyleData(style as unknown as Panel.panelConfig)
				.string()
			expect(() => importJsonString(backup)).toThrow()
		}
	})
	it('keeps valid false and zero values, repairing only invalid legacy fields', () => {
		expect(
			isValidPanelConfig({ searchBoxShow: false, backgroundBlur: 0, maxWidthUnit: '%', maxWidth: 100 }),
		).toBe(true)
		expect(sanitizePanelConfig({ logoText: 'Keep', iconTextColor: 42 })).toEqual({
			panel: { logoText: 'Keep' },
			warnings: ['iconTextColor'],
		})
	})
	it('round trips a LAN-only application and rejects one without any address', () => {
		const item = {
			title: 'NAS',
			sort: 0,
			icon: null,
			url: '',
			lanUrl: 'http://192.168.1.10',
			description: '',
			openMethod: 2,
		}
		const backup = exportJson('test')
			.addIconsData([{ title: 'Apps', sort: 0, children: [item] }])
			.string()
		expect(importJsonString(backup)?.geticons()[0].children[0].lanUrl).toBe(item.lanUrl)
		const invalid = exportJson('test')
			.addIconsData([{ title: 'Apps', sort: 0, children: [{ ...item, lanUrl: '' }] }])
			.string()
		expect(() => importJsonString(invalid)).toThrow()
	})
	it('matches the backend password byte boundaries for ASCII, Chinese and emoji', async () => {
		const rule = passwordRule('invalid')
		for (const valid of ['x'.repeat(72), '中'.repeat(24), '😀'.repeat(18)])
			await expect(rule.validator(null, valid)).resolves.toBeUndefined()
		for (const invalid of ['x'.repeat(73), '中'.repeat(25), '😀'.repeat(19), 'short'])
			await expect(rule.validator(null, invalid)).rejects.toThrow('invalid')
	})
})
