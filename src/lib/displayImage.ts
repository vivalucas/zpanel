// Reuse the server's bounded upload thumbnail only for ordinary local image URLs.
// Keep custom/remote URLs untouched, including signatures, fragments and animations.
export function uploadIconDisplaySrc(src: string, origin: string): string {
	if (
		!src ||
		src !== src.trim() ||
		src.includes('?') ||
		src.includes('#') ||
		/[\\%]/.test(src) ||
		[...src].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127) ||
		(!src.startsWith('/uploads/') && !/^https?:\/\//i.test(src)) ||
		src.split('/').some((part) => part === '.' || part === '..')
	)
		return src
	try {
		const url = new URL(src, origin)
		if (
			url.origin !== origin ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			!/^\/uploads\/(?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.(?:png|jpe?g)$/i.test(url.pathname)
		)
			return src
		return `${src}?thumbnail=1`
	} catch {
		return src
	}
}
