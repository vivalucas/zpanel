import { describe, expect, it } from 'vitest'
import { classifyWallpaper, fallbackWallpaperAppearance } from './wallpaper'

function pixels(...colors: number[]) {
	return colors.flatMap((value) => [value, value, value, 255])
}

describe('wallpaper readability', () => {
	it('uses dark text on bright images and light text on dark images', () => {
		expect(classifyWallpaper(pixels(242, 250, 255))).toEqual({ tone: 'light', mixed: false, scrim: 0 })
		expect(classifyWallpaper(pixels(8, 20, 40))).toEqual({ tone: 'dark', mixed: false, scrim: 0 })
	})
	it('protects text on mixed wallpaper even when its average looks neutral', () => {
		expect(
			classifyWallpaper(
				pixels(
					...Array.from<number>({ length: 50 }).fill(0),
					...Array.from<number>({ length: 50 }).fill(255),
				),
			).mixed,
		).toBe(true)
		expect(
			classifyWallpaper(
				pixels(
					...Array.from<number>({ length: 70 }).fill(30),
					...Array.from<number>({ length: 30 }).fill(240),
				),
			).mixed,
		).toBe(true)
	})
	it('accounts for the saved darkness overlay instead of the original image alone', () => {
		expect(classifyWallpaper(pixels(255, 255), 0.7).tone).toBe('dark')
		expect(classifyWallpaper(pixels(255), 0).tone).toBe('light')
	})
	it('retains isolated highlights instead of hiding them in brightness percentiles', () => {
		const image = pixels(...Array.from<number>({ length: 1000 }).fill(60), 0, 255)
		const appearance = classifyWallpaper(image)
		expect(appearance.tone).toBe('dark')
		expect(appearance.mixed).toBe(true)
		expect(appearance.scrim).toBeGreaterThan(0.5)
	})
	it('uses one adaptive veil to protect bright and dark patches without group panels', () => {
		expect(classifyWallpaper(pixels(0, 255)).scrim).toBeGreaterThan(0.5)
		expect(classifyWallpaper(pixels(0, 255)).scrim).toBeLessThan(0.8)
		expect(classifyWallpaper(pixels(20, 255), 0.5).scrim).toBeLessThan(
			classifyWallpaper(pixels(20, 255)).scrim,
		)
	})
	it('falls back to protected surfaces for missing or transparent pixel data', () => {
		expect(classifyWallpaper([])).toEqual(fallbackWallpaperAppearance)
		expect(classifyWallpaper([255, 255, 255, 0])).toEqual(fallbackWallpaperAppearance)
	})
})
