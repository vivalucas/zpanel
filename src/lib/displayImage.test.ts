import { describe, expect, it } from 'vitest'
import { uploadIconDisplaySrc } from './displayImage'

const origin = 'https://panel.example'

describe('local upload icon display URLs', () => {
	it('uses the existing thumbnail endpoint for plain local raster uploads', () => {
		for (const src of [
			'/uploads/public/gallery/a.png',
			'/uploads/users/3/attachment/a-b.JPG',
			'/uploads/logo.v2.jpeg',
			`${origin}/uploads/a.png`,
		])
			expect(uploadIconDisplaySrc(src, origin)).toBe(`${src}?thumbnail=1`)
	})

	it('preserves remote, custom, vector and animated image URLs', () => {
		for (const src of [
			'https://images.example/uploads/a.png',
			'http://panel.example/uploads/a.png',
			'https://panel.example:8443/uploads/a.png',
			'//panel.example/uploads/a.png',
			'/other/a.png',
			'uploads/a.png',
			'/uploads/a.svg',
			'/uploads/a.gif',
			'/uploads/system/logo/a.webp',
			'/uploads/a.apng',
			'/uploads/a.ico',
			'/uploads/a.avif',
			'data:image/png;base64,abc',
			'blob:https://panel.example/image',
			'/uploads/a.png?version=2',
			'/uploads/a.png?thumbnail=0',
			'/uploads/a.png?',
			'/uploads/a.png#fragment',
			'/uploads/a.png#',
		])
			expect(uploadIconDisplaySrc(src, origin)).toBe(src)
	})

	it('does not normalize ambiguous paths or credentialed URLs into thumbnail requests', () => {
		for (const src of [
			'',
			' /uploads/a.png',
			'/uploads/a.png ',
			'/uploads/a b.png',
			'/uploads/a%20b.png',
			'/uploads/%2e%2e/a.png',
			'/uploads/./a.png',
			'/uploads/x/../a.png',
			'/uploads//a.png',
			'/uploads/\\a.png',
			'/uploads/a.png\n',
			'/uploads/.hidden.png',
			'https://user:password@panel.example/uploads/a.png',
			'https://panel.example/other/../uploads/a.png',
			'https://[invalid/uploads/a.png',
		])
			expect(uploadIconDisplaySrc(src, origin)).toBe(src)
		expect(uploadIconDisplaySrc('/uploads/a.png', 'invalid origin')).toBe('/uploads/a.png')
	})
})
