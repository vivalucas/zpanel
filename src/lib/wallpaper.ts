export interface WallpaperAppearance {
	tone: 'light' | 'dark'
	mixed: boolean
	scrim: number
}

export const wallpaperBaseColors = {
	light: [238, 245, 255],
	dark: [17, 24, 39],
} as const
export const wallpaperVeilColors = {
	light: [250, 251, 253],
	dark: [10, 15, 23],
} as const
const inkColors = {
	light: [32, 39, 51],
	dark: [245, 247, 250],
} as const
const shadeColor = [10, 15, 30]

// Failed analysis changes the image only when the user requested automatic contrast.
export const fallbackWallpaperAppearance: WallpaperAppearance = { tone: 'dark', mixed: true, scrim: 0 }
export function getFallbackWallpaperAppearance(
	autoContrast = false,
	tone: WallpaperAppearance['tone'] = 'dark',
): WallpaperAppearance {
	return { tone: autoContrast ? 'dark' : tone, mixed: true, scrim: autoContrast ? 0.68 : 0 }
}

function darknessValue(shade: number) {
	return Number.isFinite(shade) ? Math.max(0, Math.min(1, shade)) : 0
}
export function wallpaperShadeColor(shade = 0) {
	return `rgba(${shadeColor.join(',')},${darknessValue(shade)})`
}

function linear(channel: number) {
	const value = channel / 255
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: readonly number[]) {
	return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
}

function requiredScrim(colors: number[][], tone: WallpaperAppearance['tone']) {
	const veil = wallpaperVeilColors[tone]
	const ink = luminance(inkColors[tone])
	const readable = (alpha: number) =>
		colors.every((color) => {
			const background = luminance(color.map((value, i) => value * (1 - alpha) + veil[i] * alpha))
			return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05) >= 4.8
		})
	if (readable(0)) return 0
	let lower = 0
	let upper = 1
	for (let i = 0; i < 10; i++) {
		const middle = (lower + upper) / 2
		if (readable(middle)) upper = middle
		else lower = middle
	}
	return Math.ceil(upper * 1000) / 1000
}

export function classifyWallpaper(
	pixels: ArrayLike<number>,
	shade = 0,
	autoContrast = false,
	backdrop: readonly number[] = wallpaperBaseColors.light,
): WallpaperAppearance {
	const darkness = darknessValue(shade)
	// Conservative color bounds are needed only for the explicitly enabled contrast mode.
	const minimum = autoContrast ? new Uint8Array(4096 * 3).fill(255) : undefined
	const maximum = autoContrast ? new Uint8Array(4096 * 3) : undefined
	const occupied = autoContrast ? new Uint8Array(4096) : undefined
	const channels = shadeColor.map((base) =>
		Array.from({ length: 256 }, (_, value) => linear(value * (1 - darkness) + base * darkness)),
	)
	let sum = 0
	let count = 0
	let low = 1
	let high = 0
	for (let i = 0; i + 3 < pixels.length; i += 4) {
		const alpha = pixels[i + 3] / 255
		const red = alpha === 1 ? pixels[i] : Math.round(pixels[i] * alpha + backdrop[0] * (1 - alpha))
		const green = alpha === 1 ? pixels[i + 1] : Math.round(pixels[i + 1] * alpha + backdrop[1] * (1 - alpha))
		const blue = alpha === 1 ? pixels[i + 2] : Math.round(pixels[i + 2] * alpha + backdrop[2] * (1 - alpha))
		if (minimum && maximum && occupied) {
			const bucket = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4)
			occupied[bucket] = 1
			for (let channel = 0; channel < 3; channel++) {
				const value = channel === 0 ? red : channel === 1 ? green : blue
				const index = bucket * 3 + channel
				minimum[index] = Math.min(minimum[index], value)
				maximum[index] = Math.max(maximum[index], value)
			}
		}
		const value = 0.2126 * channels[0][red] + 0.7152 * channels[1][green] + 0.0722 * channels[2][blue]
		sum += value
		count++
		low = Math.min(low, value)
		high = Math.max(high, value)
	}
	if (!count) return getFallbackWallpaperAppearance(autoContrast)
	const average = sum / count
	const mixed = (high + 0.05) / (low + 0.05) > 4.5
	if (!minimum || !maximum || !occupied) {
		const contrast = (tone: WallpaperAppearance['tone']) => {
			const ink = luminance(inkColors[tone])
			return (Math.max(ink, average) + 0.05) / (Math.min(ink, average) + 0.05)
		}
		return { tone: contrast('light') >= contrast('dark') ? 'light' : 'dark', mixed, scrim: 0 }
	}
	const colors: number[][] = []
	for (let bucket = 0; bucket < occupied.length; bucket++) {
		if (!occupied[bucket]) continue
		for (const bounds of [minimum, maximum])
			colors.push(
				shadeColor.map((base, channel) => bounds[bucket * 3 + channel] * (1 - darkness) + base * darkness),
			)
	}
	const lightScrim = requiredScrim(colors, 'light')
	const darkScrim = requiredScrim(colors, 'dark')
	// A stable average-based tie break preserves the natural tone when neither needs a veil.
	const preferredTone = average >= 0.28 ? 'light' : 'dark'
	const tone = lightScrim === darkScrim ? preferredTone : lightScrim < darkScrim ? 'light' : 'dark'
	return { tone, mixed, scrim: tone === 'light' ? lightScrim : darkScrim }
}
