import { useEffect, useState } from 'react'
import { classifyWallpaper, fallbackWallpaperAppearance } from '@/lib/wallpaper'
import type { WallpaperAppearance } from '@/lib/wallpaper'

export function useWallpaperAppearance(src?: string, shade = 0, blur = 0): WallpaperAppearance {
	const [sample, setSample] = useState<WallpaperAppearance & { src: string; shade: number; blur: number }>()
	useEffect(() => {
		if (!src) return
		let disposed = false
		let timer = 0
		const image = new Image()
		image.crossOrigin = 'anonymous'
		image.decoding = 'async'
		const analyze = () => {
			if (disposed || !image.naturalWidth || !image.naturalHeight) return
			let appearance = fallbackWallpaperAppearance
			try {
				const viewportWidth = Math.ceil(innerWidth)
				const viewportHeight = Math.ceil(innerHeight)
				// Avoid large allocations on unusually large viewports; retain the protected fallback.
				if (viewportWidth * viewportHeight > 8_388_608) {
					setSample({ src, shade, blur, ...appearance })
					return
				}
				const canvas = document.createElement('canvas')
				canvas.width = viewportWidth
				canvas.height = viewportHeight
				const context = canvas.getContext('2d', { willReadFrequently: true })
				if (context) {
					// Inspect the visible cover crop at CSS pixel resolution before blur.
					const bounds = document.querySelector('.home-background')?.getBoundingClientRect()
					const scale = Math.max(
						(bounds?.width || innerWidth) / image.naturalWidth,
						(bounds?.height || innerHeight) / image.naturalHeight,
					)
					const width = innerWidth / scale
					const height = innerHeight / scale
					context.drawImage(
						image,
						(image.naturalWidth - width) / 2,
						(image.naturalHeight - height) / 2,
						width,
						height,
						0,
						0,
						canvas.width,
						canvas.height,
					)
					appearance = classifyWallpaper(context.getImageData(0, 0, canvas.width, canvas.height).data, shade)
				}
			} catch {
				// Remote wallpapers may display without allowing canvas pixel access.
			}
			setSample({ src, shade, blur, ...appearance })
		}
		const resize = () => {
			clearTimeout(timer)
			timer = window.setTimeout(analyze, 120)
		}
		image.onload = analyze
		image.src = src
		window.addEventListener('resize', resize)
		return () => {
			disposed = true
			clearTimeout(timer)
			image.onload = null
			window.removeEventListener('resize', resize)
		}
	}, [src, shade, blur])
	return sample && sample.src === src && sample.shade === shade && sample.blur === blur
		? sample
		: fallbackWallpaperAppearance
}
