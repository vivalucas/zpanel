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
			{ wallpaperAutoContrast: 'false' },
			{ wallpaperAutoContrast: 0 },
			{ wallpaperAutoContrast: null },
		]) {
			const backup = exportJson('test')
				.addStyleData(style as unknown as Panel.panelConfig)
				.string()
			expect(() => importJsonString(backup)).toThrow()
		}
	})
	it('preserves explicit wallpaper contrast choices and legacy zero darkness through backups', () => {
		for (const wallpaperAutoContrast of [false, true]) {
			const style = { wallpaperAutoContrast, backgroundMaskNumber: 0, backgroundBlur: 0, maxWidthUnit: 'px' }
			expect(isValidPanelConfig(style)).toBe(true)
			expect(sanitizePanelConfig(style)).toEqual({ panel: style, warnings: [] })
			const backup = exportJson('test').addStyleData(style).string()
			const imported = importJsonString(backup)
			expect(imported?.isPassCheckMd5()).toBe(true)
			expect(imported?.getStyleConfig()).toEqual(style)
		}
		const legacy = { backgroundMaskNumber: 0, backgroundBlur: 0, maxWidthUnit: 'px' }
		const backup = exportJson('test').addStyleData(legacy).string()
		expect(importJsonString(backup)?.getStyleConfig()).toEqual(legacy)
		expect(sanitizePanelConfig({ ...legacy, wallpaperAutoContrast: 'false' })).toEqual({
			panel: legacy,
			warnings: ['wallpaperAutoContrast'],
		})
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
