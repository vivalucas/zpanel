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
function customContrast(
	appearance: ReturnType<typeof classifyWallpaper>,
	background: number[],
	ink: readonly number[],
) {
	const veil = wallpaperVeilColors[appearance.tone]
	const surface = background.map(
		(value, channel) => value * (1 - appearance.scrim) + veil[channel] * appearance.scrim,
	)
	const opacity = (ink[3] ?? 255) / 255
	const foreground = luminance(
		surface.map((value, channel) => ink[channel] * opacity + value * (1 - opacity)),
	)
	const behind = luminance(surface)
	return (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05)
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
	it('keeps the manual white or black ink on bright, dark, and mixed wallpapers at every darkness level', () => {
		for (const tone of ['dark', 'light'] as const) {
			for (const shade of [0, 0.15, 0.7, 1]) {
				for (const image of [pixels(0, 8, 40), pixels(242, 250, 255), pixels(0, 144, 255)]) {
					const appearance = classifyWallpaper(image, shade, false, wallpaperBaseColors.light, tone)
					expect(appearance.tone).toBe(tone)
					expect(appearance.scrim).toBe(0)
				}
			}
		}
	})
	it('adjusts the wallpaper for the manual ink without switching to the smaller opposite veil', () => {
		for (const tone of ['dark', 'light'] as const) {
			for (const shade of [0, 0.15, 0.7, 1]) {
				for (const colors of [
					[0, 8, 40],
					[242, 250, 255],
					[0, 144, 255],
				]) {
					const appearance = classifyWallpaper(
						pixels(...colors),
						shade,
						true,
						wallpaperBaseColors.light,
						tone,
					)
					expect(appearance.tone).toBe(tone)
					for (const color of colors) {
						const shaded = [10, 15, 30].map((base) => color * (1 - shade) + base * shade)
						expect(contrast(appearance, shaded)).toBeGreaterThanOrEqual(4.8)
					}
				}
			}
		}
		expect(classifyWallpaper(pixels(255), 0, true, wallpaperBaseColors.light, 'dark').scrim).toBeGreaterThan(
			0,
		)
		expect(classifyWallpaper(pixels(0), 0, true, wallpaperBaseColors.light, 'light').scrim).toBeGreaterThan(0)
	})
	it('composites transparent wallpaper and darkness before protecting the manually selected ink', () => {
		for (const tone of ['dark', 'light'] as const) {
			for (const backdrop of [wallpaperBaseColors.light, wallpaperBaseColors.dark]) {
				for (const shade of [0, 0.4, 1]) {
					for (const alpha of [0, 64, 128, 255]) {
						const rgba = [255, 40, 90, alpha, 20, 210, 240, 255 - alpha]
						const ordinary = classifyWallpaper(rgba, shade, false, backdrop, tone)
						expect(ordinary.tone).toBe(tone)
						expect(ordinary.scrim).toBe(0)
						const automatic = classifyWallpaper(rgba, shade, true, backdrop, tone)
						expect(automatic.tone).toBe(tone)
						for (let index = 0; index < rgba.length; index += 4) {
							const opacity = rgba[index + 3] / 255
							const shaded = [10, 15, 30].map((base, channel) => {
								const composited = Math.round(
									rgba[index + channel] * opacity + backdrop[channel] * (1 - opacity),
								)
								return composited * (1 - shade) + base * shade
							})
							expect(contrast(automatic, shaded)).toBeGreaterThanOrEqual(4.8)
						}
					}
				}
			}
		}
	})
	it('preserves manual ink and protects either choice when CORS or canvas analysis is unavailable', () => {
		for (const tone of ['dark', 'light'] as const) {
			for (const theme of ['dark', 'light'] as const) {
				expect(getFallbackWallpaperAppearance(false, theme, tone)).toEqual({ tone, mixed: true, scrim: 0 })
				const fallback = getFallbackWallpaperAppearance(true, theme, tone)
				expect(fallback).toEqual({ tone, mixed: true, scrim: 0.68 })
				for (let value = 0; value <= 255; value++)
					expect(contrast(fallback, [value, value, value])).toBeGreaterThanOrEqual(4.5)
			}
			for (const automatic of [false, true])
				expect(classifyWallpaper([], 0, automatic, wallpaperBaseColors.light, tone)).toEqual(
					getFallbackWallpaperAppearance(automatic, 'dark', tone),
				)
		}
	})
	it('does not darken a white wallpaper for gray custom ink and destroy its existing contrast', () => {
		const ink = [119, 119, 119, 255]
		const unchanged = classifyWallpaper(pixels(255), 0, false, wallpaperBaseColors.light, 'dark', ink)
		const automatic = classifyWallpaper(pixels(255), 0, true, wallpaperBaseColors.light, 'dark', ink)
		expect(automatic).toEqual({ tone: 'dark', mixed: false, scrim: 0 })
		expect(customContrast(automatic, [255, 255, 255], ink)).toBeGreaterThan(4.4)
		expect(customContrast(automatic, [255, 255, 255], ink)).toBe(
			customContrast(unchanged, [255, 255, 255], ink),
		)
	})
	it('chooses either existing veil for actual custom colors while keeping the fixed foreground', () => {
		for (const { ink, tone } of [
			{ ink: [0, 0, 255, 255], tone: 'light' },
			{ ink: [255, 255, 0, 255], tone: 'dark' },
			{ ink: [0, 0, 255, 220], tone: 'light' },
			{ ink: [255, 255, 255, 128], tone: 'dark' },
		] as const) {
			const originalInk = [...ink]
			const appearance = classifyWallpaper(pixels(0, 255), 0, true, wallpaperBaseColors.light, 'dark', ink)
			expect(appearance.tone).toBe(tone)
			expect(appearance.scrim).toBeGreaterThan(0)
			expect(appearance.scrim).toBeLessThan(1)
			const ratios = [0, 255].map((value) => customContrast(appearance, [value, value, value], ink))
			expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.8)
			const previous = { ...appearance, scrim: appearance.scrim - 0.001 }
			expect(
				Math.min(...[0, 255].map((value) => customContrast(previous, [value, value, value], ink))),
			).toBeLessThan(4.8)
			expect(ink).toEqual(originalInk)
		}
		const ink = [0, 0, 255, 255]
		expect(classifyWallpaper(pixels(255), 0, true, wallpaperBaseColors.light, 'dark', ink).scrim).toBe(0)
	})
	it('uses the best no-veil or solid-veil result when gray and transparent custom inks cannot reach the target', () => {
		for (const ink of [
			[119, 119, 119, 255],
			[120, 100, 130, 255],
			[0, 0, 0, 128],
			[160, 90, 170, 128],
			[45, 80, 160, 32],
			[10, 200, 40, 0],
		]) {
			for (const shade of [0, 0.2, 0.7]) {
				const backgrounds = [0, 100, 255].map((value) =>
					[10, 15, 30].map((base) => value * (1 - shade) + base * shade),
				)
				const appearance = classifyWallpaper(
					pixels(0, 100, 255),
					shade,
					true,
					wallpaperBaseColors.light,
					'dark',
					ink,
				)
				const baseline = Math.min(
					...backgrounds.map((background) =>
						customContrast({ tone: 'dark', mixed: true, scrim: 0 }, background, ink),
					),
				)
				const result = Math.min(
					...backgrounds.map((background) => customContrast(appearance, background, ink)),
				)
				expect(result).toBeGreaterThanOrEqual(baseline - 1e-12)
				const alternatives = (['light', 'dark'] as const).map((tone) =>
					Math.min(
						...backgrounds.map((background) =>
							customContrast({ tone, mixed: true, scrim: 1 }, background, ink),
						),
					),
				)
				if (Math.max(...alternatives) < 4.8) {
					expect([0, 1]).toContain(appearance.scrim)
					expect(result).toBeCloseTo(Math.max(baseline, ...alternatives), 10)
				}
			}
		}
		expect(
			classifyWallpaper(pixels(0, 100, 255), 0, true, wallpaperBaseColors.light, 'dark', [10, 200, 40, 0])
				.scrim,
		).toBe(0)
	})
	it('does not invent an automatic custom-color veil when no pixels can be inspected', () => {
		for (const tone of ['light', 'dark'] as const) {
			for (const ink of [
				[119, 119, 119, 255],
				[255, 0, 0, 128],
			]) {
				for (const automatic of [false, true])
					expect(classifyWallpaper([], 0, automatic, wallpaperBaseColors.light, tone, ink)).toEqual({
						tone,
						mixed: true,
						scrim: 0,
					})
				const ordinary = classifyWallpaper(pixels(0, 255), 0, false, wallpaperBaseColors.light, tone, ink)
				expect(ordinary.tone).toBe(tone)
				expect(ordinary.scrim).toBe(0)
			}
		}
	})
	it('leaves unsupported and invalid custom inks unaltered instead of calculating NaN channels', () => {
		for (const ink of [
			[],
			[0, 0, 0],
			[0, 0, 0, NaN],
			[Infinity, 0, 0, 255],
			[-1, 0, 0, 255],
			[0, 0, 0, 256],
		]) {
			for (const tone of ['light', 'dark'] as const) {
				for (const automatic of [false, true])
					expect(
						classifyWallpaper(pixels(0, 255), 0, automatic, wallpaperBaseColors.light, tone, ink),
					).toEqual({ tone, mixed: true, scrim: 0 })
			}
		}
	})
	it('uses one shared manual shade color and clamps its range', () => {
		expect(wallpaperShadeColor(0)).toBe('rgba(10,15,30,0)')
		expect(wallpaperShadeColor(0.5)).toBe('rgba(10,15,30,0.5)')
		expect(wallpaperShadeColor(-1)).toBe(wallpaperShadeColor(0))
		expect(wallpaperShadeColor(2)).toBe(wallpaperShadeColor(1))
	})
})
