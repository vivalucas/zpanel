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
	preferredTone?: WallpaperAppearance['tone'],
): WallpaperAppearance {
	return {
		tone: preferredTone ?? (autoContrast ? 'dark' : tone),
		mixed: true,
		scrim: autoContrast ? 0.68 : 0,
	}
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

export function isAnalyzableWallpaperInk(ink: readonly number[]) {
	return ink.length === 4 && ink.every((value) => Number.isFinite(value) && value >= 0 && value <= 255)
}

function measuredInkContrast(
	pixels: ArrayLike<number>,
	shade: number,
	backdrop: readonly number[],
	ink: readonly number[],
	appearance: Pick<WallpaperAppearance, 'tone' | 'scrim'>,
) {
	const veil = wallpaperVeilColors[appearance.tone]
	const opacity = ink[3] / 255
	const surfaces = shadeColor.map((base, channel) =>
		Array.from(
			{ length: 256 },
			(_, value) =>
				(value * (1 - shade) + base * shade) * (1 - appearance.scrim) + veil[channel] * appearance.scrim,
		),
	)
	const backgroundChannels = surfaces.map((channel) => channel.map(linear))
	const foregroundChannels = surfaces.map((channel, index) =>
		channel.map((value) => linear(ink[index] * opacity + value * (1 - opacity))),
	)
	let lowest = Infinity
	for (let index = 0; index + 3 < pixels.length; index += 4) {
		const alpha = pixels[index + 3] / 255
		const rgb = [0, 1, 2].map((channel) =>
			alpha === 1
				? pixels[index + channel]
				: Math.round(pixels[index + channel] * alpha + backdrop[channel] * (1 - alpha)),
		)
		const background =
			0.2126 * backgroundChannels[0][rgb[0]] +
			0.7152 * backgroundChannels[1][rgb[1]] +
			0.0722 * backgroundChannels[2][rgb[2]]
		const foreground =
			0.2126 * foregroundChannels[0][rgb[0]] +
			0.7152 * foregroundChannels[1][rgb[1]] +
			0.0722 * foregroundChannels[2][rgb[2]]
		lowest = Math.min(
			lowest,
			(Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
		)
	}
	return lowest
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

function customInkScrim(
	colors: number[][],
	ink: readonly number[],
	initialTone: WallpaperAppearance['tone'],
	unveiledContrast: number,
): Pick<WallpaperAppearance, 'tone' | 'scrim'> {
	const opacity = Math.max(0, Math.min(1, (ink[3] ?? 255) / 255))
	const opaqueInk = luminance(ink)
	const contrast = (color: number[], veil: readonly number[], alpha: number) => {
		const surface = color.map((value, channel) => value * (1 - alpha) + veil[channel] * alpha)
		const background = luminance(surface)
		const foreground =
			opacity === 1
				? opaqueInk
				: luminance(surface.map((value, channel) => ink[channel] * opacity + value * (1 - opacity)))
		return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
	}
	const minimumContrast = (veil: readonly number[], alpha: number) =>
		colors.reduce((lowest, color) => Math.min(lowest, contrast(color, veil, alpha)), Infinity)
	let best: Pick<WallpaperAppearance, 'tone' | 'scrim'> = { tone: initialTone, scrim: 0 }
	let bestContrast = unveiledContrast
	if (bestContrast >= 4.8) return best
	let readable: Pick<WallpaperAppearance, 'tone' | 'scrim'> | undefined
	for (const tone of [initialTone, initialTone === 'dark' ? 'light' : 'dark'] as const) {
		const veil = wallpaperVeilColors[tone]
		const fullContrast = minimumContrast(veil, 1)
		if (fullContrast > bestContrast) {
			best = { tone, scrim: 1 }
			bestContrast = fullContrast
		}
		if (fullContrast < 4.8) continue
		let weakest = 0
		const allReadable = (alpha: number) => {
			// Most candidate strengths fail on the same local color. Check that color first
			// rather than revisiting every retained color for each 0.001 step.
			if (contrast(colors[weakest], veil, alpha) < 4.8) return false
			for (let index = 0; index < colors.length; index++) {
				if (index !== weakest && contrast(colors[index], veil, alpha) < 4.8) {
					weakest = index
					return false
				}
			}
			return true
		}
		// A custom color can lose contrast before gaining it in the other direction.
		// Scan at the existing 0.001 precision instead of assuming a monotonic ratio.
		for (let step = 1; step <= 1000; step++) {
			const alpha = step / 1000
			if (!allReadable(alpha)) continue
			if (!readable || alpha < readable.scrim) readable = { tone, scrim: alpha }
			break
		}
	}
	// Some gray or translucent inks cannot reach the target even on a solid veil.
	// Preserve the unaltered image unless a full veil actually improves its worst ratio.
	return readable ?? best
}

export function classifyWallpaper(
	pixels: ArrayLike<number>,
	shade = 0,
	autoContrast = false,
	backdrop: readonly number[] = wallpaperBaseColors.light,
	preferredTone?: WallpaperAppearance['tone'],
	preferredInk?: readonly number[],
): WallpaperAppearance {
	if (preferredInk && !isAnalyzableWallpaperInk(preferredInk))
		return { tone: preferredTone ?? 'dark', mixed: true, scrim: 0 }
	const darkness = darknessValue(shade)
	// Conservative color bounds are needed only for the explicitly enabled contrast mode.
	const minimum = autoContrast ? new Uint8Array(4096 * 3).fill(255) : undefined
	const maximum = autoContrast ? new Uint8Array(4096 * 3) : undefined
	const occupied = autoContrast ? new Uint8Array(4096) : undefined
	const channels = shadeColor.map((base) =>
		Array.from({ length: 256 }, (_, value) => linear(value * (1 - darkness) + base * darkness)),
	)
	const inkOpacity = Math.max(0, Math.min(1, (preferredInk?.[3] ?? 255) / 255))
	const foregroundChannels =
		autoContrast && preferredInk
			? shadeColor.map((base, channel) =>
					Array.from({ length: 256 }, (_, value) =>
						linear(
							preferredInk[channel] * inkOpacity +
								(value * (1 - darkness) + base * darkness) * (1 - inkOpacity),
						),
					),
				)
			: undefined
	let unveiledContrast = Infinity
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
		if (foregroundChannels) {
			const foreground =
				0.2126 * foregroundChannels[0][red] +
				0.7152 * foregroundChannels[1][green] +
				0.0722 * foregroundChannels[2][blue]
			// Preserve the actual image's worst ratio, not a synthetic bucket corner, when
			// deciding whether an unreachable custom color benefits from a full veil.
			unveiledContrast = Math.min(
				unveiledContrast,
				(Math.max(foreground, value) + 0.05) / (Math.min(foreground, value) + 0.05),
			)
		}
		sum += value
		count++
		low = Math.min(low, value)
		high = Math.max(high, value)
	}
	if (!count) return getFallbackWallpaperAppearance(autoContrast && !preferredInk, 'dark', preferredTone)
	const average = sum / count
	const mixed = (high + 0.05) / (low + 0.05) > 4.5
	if (!minimum || !maximum || !occupied) {
		if (preferredTone) return { tone: preferredTone, mixed, scrim: 0 }
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
	if (preferredInk) {
		const adjustment = customInkScrim(colors, preferredInk, preferredTone ?? 'dark', unveiledContrast)
		// Bucket corners bound the search. Verify a partial veil against the original pixels
		// so a custom foreground cannot lose contrast inside one of those color ranges.
		if (
			adjustment.scrim > 0 &&
			adjustment.scrim < 1 &&
			measuredInkContrast(pixels, darkness, backdrop, preferredInk, adjustment) < 4.8
		)
			return { ...adjustment, mixed, scrim: 1 }
		return { ...adjustment, mixed }
	}
	// Automatic contrast adjusts the image for the manual text choice; it must never
	// reverse that choice simply because the opposite ink would need a smaller veil.
	if (preferredTone) return { tone: preferredTone, mixed, scrim: requiredScrim(colors, preferredTone) }
	const lightScrim = requiredScrim(colors, 'light')
	const darkScrim = requiredScrim(colors, 'dark')
	// A stable average-based tie break preserves the natural tone when neither needs a veil.
	const naturalTone = average >= 0.28 ? 'light' : 'dark'
	const tone = lightScrim === darkScrim ? naturalTone : lightScrim < darkScrim ? 'light' : 'dark'
	return { tone, mixed, scrim: tone === 'light' ? lightScrim : darkScrim }
}
