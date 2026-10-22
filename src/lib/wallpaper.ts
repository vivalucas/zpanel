export interface WallpaperAppearance {
	tone: 'light' | 'dark'
	mixed: boolean
	scrim: number
}

// Unreadable images get one page-wide veil rather than separate content panels.
export const fallbackWallpaperAppearance: WallpaperAppearance = { tone: 'dark', mixed: true, scrim: 0.68 }

function linear(channel: number) {
	const value = channel / 255
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: number[]) {
	return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2])
}

export function classifyWallpaper(pixels: ArrayLike<number>, shade = 0): WallpaperAppearance {
	const darkness = Math.max(0, Math.min(1, shade))
	// Keep channel bounds in small color buckets, rather than averaging away highlights.
	const minimum = new Uint8Array(4096 * 3).fill(255)
	const maximum = new Uint8Array(4096 * 3)
	const occupied = new Uint8Array(4096)
	const channels = [10, 15, 30].map((base) =>
		Array.from({ length: 256 }, (_, value) => linear(value * (1 - darkness) + base * darkness)),
	)
	let sum = 0
	let count = 0
	let low = 1
	let high = 0
	for (let i = 0; i + 3 < pixels.length; i += 4) {
		if (pixels[i + 3] < 250) return fallbackWallpaperAppearance
		const red = pixels[i]
		const green = pixels[i + 1]
		const blue = pixels[i + 2]
		const bucket = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4)
		occupied[bucket] = 1
		for (let channel = 0; channel < 3; channel++) {
			const index = bucket * 3 + channel
			minimum[index] = Math.min(minimum[index], pixels[i + channel])
			maximum[index] = Math.max(maximum[index], pixels[i + channel])
		}
		const value = 0.2126 * channels[0][red] + 0.7152 * channels[1][green] + 0.0722 * channels[2][blue]
		sum += value
		count++
		low = Math.min(low, value)
		high = Math.max(high, value)
	}
	if (!count) return fallbackWallpaperAppearance
	const colors: number[][] = []
	for (let bucket = 0; bucket < occupied.length; bucket++) {
		if (!occupied[bucket]) continue
		for (const bounds of [minimum, maximum])
			colors.push(
				[10, 15, 30].map((base, channel) => bounds[bucket * 3 + channel] * (1 - darkness) + base * darkness),
			)
	}
	const tone = sum / count >= 0.28 ? 'light' : 'dark'
	const veil = tone === 'light' ? [250, 251, 253] : [10, 15, 23]
	const ink = luminance(tone === 'light' ? [32, 39, 51] : [245, 247, 250])
	const readable = (alpha: number) =>
		colors.every((color) => {
			const background = luminance(color.map((value, i) => value * (1 - alpha) + veil[i] * alpha))
			return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05) >= 4.8
		})
	let scrim = 0
	if (!readable(0)) {
		let lower = 0
		let upper = 1
		for (let i = 0; i < 10; i++) {
			const middle = (lower + upper) / 2
			if (readable(middle)) upper = middle
			else lower = middle
		}
		scrim = Math.ceil(upper * 1000) / 1000
	}
	return {
		tone,
		mixed: (high + 0.05) / (low + 0.05) > 4.5,
		scrim,
	}
}
