import { describe, expect, it } from 'vitest'
import {
	classifyWallpaper,
	fallbackWallpaperAppearance,
	getFallbackWallpaperAppearance,
	wallpaperBaseColors,
	wallpaperShadeColor,
	wallpaperVeilColors,
} from './wallpaper'

function pixels(...colors: number[]) {
	return colors.flatMap((value) => [value, value, value, 255])
}
function luminance(rgb: readonly number[]) {
	return rgb.reduce((sum, value, i) => {
		const s = value / 255
		return sum + [0.2126, 0.7152, 0.0722][i] * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)
	}, 0)
}
function contrast(appearance: ReturnType<typeof classifyWallpaper>, background: number[]) {
	const ink = luminance(appearance.tone === 'light' ? [32, 39, 51] : [245, 247, 250])
	const veil = wallpaperVeilColors[appearance.tone]
	const surface = luminance(
		background.map((value, i) => value * (1 - appearance.scrim) + veil[i] * appearance.scrim),
	)
	return (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05)
}

describe('wallpaper readability', () => {
	it('uses dark text on bright images and light text on dark images without changing the image', () => {
		for (const auto of [false, true]) {
			expect(classifyWallpaper(pixels(242, 250, 255), 0, auto)).toEqual({
				tone: 'light',
				mixed: false,
				scrim: 0,
			})
			expect(classifyWallpaper(pixels(8, 20, 40), 0, auto)).toEqual({ tone: 'dark', mixed: false, scrim: 0 })
		}
	})
	it('chooses the readable dark ink on uniform mid-gray backgrounds without adding a veil', () => {
		for (const value of [143, 144]) {
			const appearance = classifyWallpaper(pixels(value))
			expect(appearance).toEqual({ tone: 'light', mixed: false, scrim: 0 })
			expect(contrast(appearance, [value, value, value])).toBeGreaterThanOrEqual(4.5)
		}
	})
	it('selects the higher-contrast available ink across the gray range and manual darkness levels', () => {
		for (const shade of [0, 0.15, 0.7, 1]) {
			for (let value = 0; value <= 255; value++) {
				const appearance = classifyWallpaper(pixels(value), shade)
				const background = [10, 15, 30].map((base) => value * (1 - shade) + base * shade)
				const alternate = { ...appearance, tone: appearance.tone === 'light' ? 'dark' : 'light' } as const
				expect(appearance.scrim).toBe(0)
				expect(contrast(appearance, background)).toBeGreaterThanOrEqual(contrast(alternate, background))
			}
		}
	})
	it('keeps mixed backgrounds and isolated highlights unaltered by default', () => {
		for (const image of [pixels(0, 255), pixels(...Array.from<number>({ length: 1000 }).fill(60), 0, 255)]) {
			const appearance = classifyWallpaper(image)
			expect(appearance.mixed).toBe(true)
			expect(appearance.scrim).toBe(0)
		}
	})
	it('accounts for the saved darkness overlay when choosing text colors', () => {
		expect(classifyWallpaper(pixels(255, 255), 0.7).tone).toBe('dark')
		expect(classifyWallpaper(pixels(255), 0).tone).toBe('light')
	})
	it('protects every retained local color only in the enabled automatic mode', () => {
		for (const colors of [
			[0, 255],
			[30, 240],
			[60, 0, 255],
		]) {
			const appearance = classifyWallpaper(pixels(...colors), 0, true)
			expect(appearance.scrim).toBeGreaterThan(0)
			for (const color of colors)
				expect(contrast(appearance, [color, color, color])).toBeGreaterThanOrEqual(4.8)
		}
	})
	it('chooses the smaller of the light and dark veils instead of the average-based tone', () => {
		const image = pixels(...Array.from<number>({ length: 1000 }).fill(60), 0, 255)
		expect(classifyWallpaper(image).tone).toBe('dark')
		const automatic = classifyWallpaper(image, 0, true)
		expect(automatic.tone).toBe('light')
		expect(automatic.scrim).toBeLessThan(0.607)
		expect(automatic.scrim).toBeGreaterThan(0.5)
	})
	it('composites transparent images over the actual base rather than using a dark fallback', () => {
		const transparent = [255, 255, 255, 0]
		for (const auto of [false, true]) {
			expect(classifyWallpaper(transparent, 0, auto, wallpaperBaseColors.light)).toEqual({
				tone: 'light',
				mixed: false,
				scrim: 0,
			})
			expect(classifyWallpaper(transparent, 0, auto, wallpaperBaseColors.dark)).toEqual({
				tone: 'dark',
				mixed: false,
				scrim: 0,
			})
			const halfWhite = classifyWallpaper([255, 255, 255, 128], 0, auto, wallpaperBaseColors.dark)
			expect(halfWhite.mixed).toBe(false)
		}
	})
	it('reserves conservative fallback veils for explicit automatic contrast', () => {
		expect(classifyWallpaper([])).toEqual(fallbackWallpaperAppearance)
		expect(classifyWallpaper([], 0, true)).toEqual({ tone: 'dark', mixed: true, scrim: 0.68 })
		expect(getFallbackWallpaperAppearance(false, 'light')).toEqual({ tone: 'light', mixed: true, scrim: 0 })
		expect(getFallbackWallpaperAppearance(true, 'light')).toEqual({ tone: 'dark', mixed: true, scrim: 0.68 })
	})
	it('uses one shared manual shade color and clamps its range', () => {
		expect(wallpaperShadeColor(0)).toBe('rgba(10,15,30,0)')
		expect(wallpaperShadeColor(0.5)).toBe('rgba(10,15,30,0.5)')
		expect(wallpaperShadeColor(-1)).toBe(wallpaperShadeColor(0))
		expect(wallpaperShadeColor(2)).toBe(wallpaperShadeColor(1))
	})
})
