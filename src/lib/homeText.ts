import { iconForeground } from './iconColor'
import type { WallpaperAppearance } from './wallpaper'

// These colors depend on inheritance or the platform palette, including legacy
// system aliases that browsers still accept inside relative and mixed colors.
const contextualColorKeywords = new Set(
	(
		'inherit initial unset revert revert-layer currentcolor ' +
		'accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext ' +
		'field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext ' +
		'activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext ' +
		'inactiveborder inactivecaption inactivecaptiontext infobackground infotext menu menutext scrollbar ' +
		'threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext'
	).split(' '),
)

function decodedCss(value: string) {
	return value.replace(
		/\\([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\\([^\n\r\f])/gi,
		(_, hex: string | undefined, character: string) => {
			if (!hex) return character
			const code = Number.parseInt(hex, 16)
			return code > 0 && code <= 0x10FFFF && !(code >= 0xD800 && code <= 0xDFFF)
				? String.fromCodePoint(code)
				: '\uFFFD'
		},
	)
}

export function homeTextPreset(value?: string): 'white' | 'black' | 'custom' {
	const color = value?.trim().toLowerCase()
	// The old Vue default was already treated as an unset preference.
	if (!color || ['#fff', '#ffffff', 'white', '#1f2937'].includes(color)) return 'white'
	if (['#000', '#000000', 'black', '#202733'].includes(color)) return 'black'
	return 'custom'
}

function customInk(color: string): readonly number[] {
	if (typeof document === 'undefined' || !CSS.supports('color', color)) return []
	// Normalize only the analysis input; the user's CSS string remains untouched.
	const style = document.createElement('span').style
	style.color = color
	const normalized = style.color
	const decoded = decodedCss(normalized).toLowerCase()
	if (
		!normalized ||
		/(?:var|env|attr|light-dark)\(/i.test(decoded) ||
		decoded
			.match(/[a-z-]+/g)
			?.some((keyword) => contextualColorKeywords.has(keyword) || /^-(?:webkit|moz)-/.test(keyword))
	)
		return []
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = 1
	const context = canvas.getContext('2d', { willReadFrequently: true })
	if (!context) return []
	// CSS accepts values that Canvas cannot resolve. A rejected fillStyle silently
	// retains its previous value; two different seeds distinguish that from real ink.
	context.fillStyle = '#010203'
	context.fillStyle = normalized
	const parsed = context.fillStyle
	context.fillStyle = '#040506'
	context.fillStyle = normalized
	if (context.fillStyle !== parsed) return []
	context.fillRect(0, 0, 1, 1)
	return [...context.getImageData(0, 0, 1, 1).data]
}

export function resolveHomeText(value?: string): {
	color: string
	tone: WallpaperAppearance['tone']
	ink?: readonly number[]
} {
	const preset = homeTextPreset(value)
	if (preset === 'white') return { color: '#ffffff', tone: 'dark' }
	const color = value!.trim()
	if (preset === 'black') return { color, tone: 'light' }
	// Resolve only the user's fixed color, never pixels from their wallpaper.
	return {
		color,
		tone: iconForeground(color, '#ffffff') === '#ffffff' ? 'light' : 'dark',
		ink: customInk(color),
	}
}
