// Resolve CSS colors through the browser, including named colors and alpha channels.
export function iconForeground(background: string | undefined, backdrop: string): string | undefined {
	if (!background || typeof document === 'undefined' || !CSS.supports('color', background)) return
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = 1
	const context = canvas.getContext('2d', { willReadFrequently: true })
	if (!context) return
	context.fillStyle = backdrop
	context.fillRect(0, 0, 1, 1)
	context.fillStyle = background
	context.fillRect(0, 0, 1, 1)
	const rgb = context.getImageData(0, 0, 1, 1).data
	const luminance = [0.2126, 0.7152, 0.0722].reduce((sum, weight, channel) => {
		const value = rgb[channel] / 255
		return sum + weight * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
	}, 0)
	return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff'
}
