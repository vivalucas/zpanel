const stringFields: Record<string, number> = {
	logoText: 200,
	logoImageSrc: 2048,
	backgroundImageSrc: 2048,
	iconTextColor: 100,
	clockColor: 100,
	footerHtml: 65536,
}
const boolFields = new Set([
	'iconTextInfoHideDescription',
	'iconTextIconHideTitle',
	'clockShowSecond',
	'searchBoxShow',
	'searchBoxSearchIcon',
	'systemMonitorShow',
	'systemMonitorShowTitle',
	'systemMonitorPublicVisitModeShow',
	'netModeChangeButtonShow',
])
const numberFields: Record<string, [number, number]> = {
	backgroundBlur: [0, 30],
	backgroundMaskNumber: [0, 1],
	marginTop: [0, 50],
	marginBottom: [0, 50],
	marginX: [0, 100],
	maxWidth: [1, 3000],
}
function validField(key: string, value: unknown): boolean {
	if (Object.hasOwn(stringFields, key))
		return typeof value === 'string' && Array.from(value).length <= stringFields[key]
	if (boolFields.has(key)) return typeof value === 'boolean'
	if (Object.hasOwn(numberFields, key))
		return (
			typeof value === 'number' &&
			Number.isFinite(value) &&
			value >= numberFields[key][0] &&
			value <= numberFields[key][1]
		)
	if (key === 'iconStyle') return value === 1 || value === 2
	if (key === 'maxWidthUnit') return value === 'px' || value === '%'
	return true
}
export function isValidPanelConfig(value: unknown): value is Partial<Panel.panelConfig> {
	return (
		!!value &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.entries(value).every(([key, entry]) => validField(key, entry))
	)
}
export function sanitizePanelConfig(value: unknown) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return { panel: {}, warnings: ['panel'] }
	const panel: Record<string, unknown> = {}
	const warnings: string[] = []
	for (const [key, entry] of Object.entries(value)) {
		if (validField(key, entry)) panel[key] = entry
		else warnings.push(key)
	}
	return { panel: panel as Partial<Panel.panelConfig>, warnings }
}
