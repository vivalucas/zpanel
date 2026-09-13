export function bytes(value: number) {
	if (!Number.isFinite(value)) return '—'
	if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`
	if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`
	return `${(value / 1024 ** 3).toFixed(1)} GB`
}
