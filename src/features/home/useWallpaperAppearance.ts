import { useEffect, useState, useSyncExternalStore } from 'react'
import { classifyWallpaper, getFallbackWallpaperAppearance, wallpaperBaseColors } from '@/lib/wallpaper'
import type { WallpaperAppearance } from '@/lib/wallpaper'
import { useWallpaperViewport } from './useWallpaperViewport'

export interface WallpaperState extends WallpaperAppearance {
	status: 'none' | 'loading' | 'ready' | 'unreadable' | 'error'
}
type Sample = WallpaperState & { key: string; src: string }

function currentTheme(): WallpaperAppearance['tone'] {
	return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function subscribeTheme(onChange: () => void) {
	const observer = new MutationObserver(onChange)
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
	return () => observer.disconnect()
}

export function useWallpaperAppearance(
	src?: string,
	shade = 0,
	blur = 0,
	autoContrast = false,
): WallpaperState {
	const theme = useSyncExternalStore(subscribeTheme, currentTheme, currentTheme)
	const viewport = useWallpaperViewport()
	const [sample, setSample] = useState<Sample>()
	const key = JSON.stringify([src, shade, blur, autoContrast, theme, viewport?.width, viewport?.height])
	useEffect(() => {
		if (!src || !viewport) return
		let disposed = false
		let samplingImage: HTMLImageElement | undefined
		const displayImage = new Image()
		displayImage.decoding = 'async'
		const commit = (appearance: WallpaperAppearance, status: WallpaperState['status']) => {
			if (!disposed) setSample({ src, key, ...appearance, status })
		}
		const unreadable = () => commit(getFallbackWallpaperAppearance(autoContrast, theme), 'unreadable')
		const analyze = () => {
			if (disposed || !samplingImage?.naturalWidth || !samplingImage.naturalHeight) return
			const { width: viewportWidth, height: viewportHeight } = viewport
			if (autoContrast && Math.ceil(viewportWidth) * Math.ceil(viewportHeight) > 8_388_608) {
				unreadable()
				return
			}
			try {
				const canvas = document.createElement('canvas')
				// Default mode only selects colors, so it never allocates a full-screen bitmap.
				const sampleScale = autoContrast ? 1 : Math.min(1, 256 / Math.max(viewportWidth, viewportHeight))
				canvas.width = Math.max(1, Math.ceil(viewportWidth * sampleScale))
				canvas.height = Math.max(1, Math.ceil(viewportHeight * sampleScale))
				const context = canvas.getContext('2d', { willReadFrequently: true })
				if (!context) {
					unreadable()
					return
				}
				// The image expands by twice the blur radius on each side in both renderers.
				const expansion = 4 * Math.max(0, blur)
				const scale = Math.max(
					(viewportWidth + expansion) / samplingImage.naturalWidth,
					(viewportHeight + expansion) / samplingImage.naturalHeight,
				)
				const width = viewportWidth / scale
				const height = viewportHeight / scale
				context.drawImage(
					samplingImage,
					(samplingImage.naturalWidth - width) / 2,
					(samplingImage.naturalHeight - height) / 2,
					width,
					height,
					0,
					0,
					canvas.width,
					canvas.height,
				)
				commit(
					classifyWallpaper(
						context.getImageData(0, 0, canvas.width, canvas.height).data,
						shade,
						autoContrast,
						wallpaperBaseColors[theme],
					),
					'ready',
				)
			} catch {
				unreadable()
			}
		}
		// CSS backgrounds can display a remote image even when canvas CORS access is denied.
		// Check ordinary display first so that CORS rejection is never reported as a broken image.
		displayImage.onload = () => {
			if (disposed) return
			if (!displayImage.naturalWidth || !displayImage.naturalHeight) {
				commit({ tone: theme, mixed: false, scrim: 0 }, 'error')
				return
			}
			samplingImage = new Image()
			samplingImage.crossOrigin = 'anonymous'
			samplingImage.decoding = 'async'
			samplingImage.onload = () => {
				if (!samplingImage?.naturalWidth || !samplingImage.naturalHeight) unreadable()
				else analyze()
			}
			samplingImage.onerror = unreadable
			samplingImage.src = src
		}
		displayImage.onerror = () => commit({ tone: theme, mixed: false, scrim: 0 }, 'error')
		displayImage.src = src
		return () => {
			disposed = true
			displayImage.onload = null
			displayImage.onerror = null
			if (samplingImage) {
				samplingImage.onload = null
				samplingImage.onerror = null
			}
		}
	}, [src, shade, blur, autoContrast, theme, viewport, key])
	if (!src) return { tone: theme, mixed: false, scrim: 0, status: 'none' }
	if (sample?.key === key) return sample
	return { tone: sample?.src === src ? sample.tone : theme, mixed: false, scrim: 0, status: 'loading' }
}
