export function passwordRule(message: string, writing = true) {
	return {
		validator: (_: unknown, value: string | undefined) => {
			if (!value) return Promise.resolve()
			const bytes = new TextEncoder().encode(value).length
			return bytes <= 72 && (!writing || bytes >= 6) ? Promise.resolve() : Promise.reject(new Error(message))
		},
	}
}
