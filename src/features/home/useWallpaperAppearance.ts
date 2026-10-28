import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
	classifyWallpaper,
	getFallbackWallpaperAppearance,
	isAnalyzableWallpaperInk,
	wallpaperBaseColors,
	wallpaperBackgroundTone,
} from '@/lib/wallpaper'
import type { WallpaperAppearance } from '@/lib/wallpaper'
import { useWallpaperViewport } from './useWallpaperViewport'

export interface WallpaperState extends WallpaperAppearance {
	status: 'none' | 'loading' | 'ready' | 'unreadable' | 'error'
	backgroundTone?: WallpaperAppearance['tone']
	displayReady?: boolean
}
type Sample = WallpaperState & { key: string; context: string; protection: string; src: string }

function currentTheme(): WallpaperAppearance['tone'] {
	return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
		? 'dark'
		: 'light'
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
	analysisDelay = 0,
	preferredTone?: WallpaperAppearance['tone'],
	preferredInk?: readonly number[],
): WallpaperState {
	const theme = useSyncExternalStore(subscribeTheme, currentTheme, currentTheme)
	const viewport = useWallpaperViewport()
	const [sample, setSample] = useState<Sample>()
	const [decodedSrc, setDecodedSrc] = useState<string>()
	const imageRef = useRef<{ src: string; image: HTMLImageElement } | undefined>(undefined)
	const protection = JSON.stringify([src, autoContrast, preferredTone, preferredInk])
	const context = JSON.stringify([
		src,
		autoContrast,
		theme,
		viewport?.width,
		viewport?.height,
		preferredTone,
		preferredInk,
	])
	const key = JSON.stringify([
		src,
		shade,
		blur,
		autoContrast,
		theme,
		viewport?.width,
		viewport?.height,
		preferredTone,
		preferredInk,
	])
	useEffect(() => {
		if (!src || !viewport) return
		let disposed = false
		let displayFailed = false
		let timer = 0
		let displayTimer = 0
		let analysisTimer = 0
		let samplingImage: HTMLImageElement | undefined
		let displayImage: HTMLImageElement | undefined
		const commit = (
			appearance: WallpaperAppearance & Pick<WallpaperState, 'backgroundTone'>,
			status: WallpaperState['status'],
		) => {
			clearTimeout(displayTimer)
			clearTimeout(analysisTimer)
			if (!disposed) setSample({ src, key, context, protection, ...appearance, status })
		}
		const unreadable = () =>
			commit(
				{
					...getFallbackWallpaperAppearance(autoContrast && !preferredInk, theme, preferredTone),
					backgroundTone: 'dark',
				},
				'unreadable',
			)
		const failDisplay = () => {
			displayFailed = true
			commit({ tone: preferredTone ?? theme, mixed: false, scrim: 0, backgroundTone: theme }, 'error')
		}
		const analyze = () => {
			if (disposed || !samplingImage?.naturalWidth || !samplingImage.naturalHeight) return
			if (preferredInk && !isAnalyzableWallpaperInk(preferredInk)) {
				commit({ tone: preferredTone ?? theme, mixed: true, scrim: 0, backgroundTone: 'dark' }, 'ready')
				return
			}
			const { width: viewportWidth, height: viewportHeight } = viewport
			if (autoContrast && Math.ceil(viewportWidth) * Math.ceil(viewportHeight) > 8_388_608) {
				unreadable()
				return
			}
			try {
				const canvas = document.createElement('canvas')
				// Only automatic contrast needs full-screen color bounds; ordinary mode stays bounded.
				const sampleScale = autoContrast ? 1 : Math.min(1, 256 / Math.max(viewportWidth, viewportHeight))
				canvas.width = Math.max(1, Math.ceil(viewportWidth * sampleScale))
				canvas.height = Math.max(1, Math.ceil(viewportHeight * sampleScale))
				const context = canvas.getContext('2d', { willReadFrequently: true })
				if (!context) {
					unreadable()
					return
				}
				// The image expands by twice the blur radius on each side in both renderers.
				const radius = Math.max(0, blur)
				const expansion = 4 * radius
				const layerWidth = viewportWidth + expansion
				const layerHeight = viewportHeight + expansion
				const scale = Math.max(
					layerWidth / samplingImage.naturalWidth,
					layerHeight / samplingImage.naturalHeight,
				)
				if (radius > 0) {
					// Composite the same expanded CSS background before filtering. Sampling only
					// its original colors misses darker mixtures at colored blur boundaries.
					const layer = document.createElement('canvas')
					layer.width = Math.ceil(layerWidth * sampleScale)
					layer.height = Math.ceil(layerHeight * sampleScale)
					if (layer.width * layer.height > 16_777_216 || !('filter' in context)) {
						unreadable()
						return
					}
					const layerContext = layer.getContext('2d')
					if (!layerContext) {
						unreadable()
						return
					}
					const width = layerWidth / scale
					const height = layerHeight / scale
					layerContext.fillStyle = `rgb(${wallpaperBaseColors[theme].join(',')})`
					layerContext.fillRect(0, 0, layerWidth * sampleScale, layerHeight * sampleScale)
					layerContext.drawImage(
						samplingImage,
						(samplingImage.naturalWidth - width) / 2,
						(samplingImage.naturalHeight - height) / 2,
						width,
						height,
						0,
						0,
						layerWidth * sampleScale,
						layerHeight * sampleScale,
					)
					context.filter = `blur(${radius * sampleScale}px)`
					context.drawImage(layer, -2 * radius * sampleScale, -2 * radius * sampleScale)
				} else {
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
				}
				const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
				const appearance = classifyWallpaper(
					pixels,
					shade,
					autoContrast,
					wallpaperBaseColors[theme],
					preferredTone,
					preferredInk,
				)
				commit(
					{
						...appearance,
						backgroundTone: wallpaperBackgroundTone(pixels, shade, wallpaperBaseColors[theme], appearance),
					},
					'ready',
				)
			} catch {
				unreadable()
			}
		}
		const load = () => {
			if (imageRef.current?.src === src) {
				setDecodedSrc(src)
				samplingImage = imageRef.current.image
				analyze()
				return
			}
			// CSS can display a remote image even when canvas CORS access is denied.
			// Check ordinary display first so CORS rejection is not reported as a broken image.
			displayImage = new Image()
			displayImage.decoding = 'async'
			displayImage.onload = async () => {
				if (disposed || displayFailed) return
				if (!displayImage?.naturalWidth || !displayImage.naturalHeight) {
					failDisplay()
					return
				}
				// Keep the startup surface until the ordinary display image is decoded.
				try {
					await displayImage.decode()
				} catch {
					// A displayable image can still reject decode(); keep normal load/error handling.
				}
				if (disposed || displayFailed) return
				clearTimeout(displayTimer)
				setDecodedSrc(src)
				// First-use automatic contrast must not briefly reveal the bright, unmasked
				// original. A stalled CORS analysis falls back without blocking display forever.
				analysisTimer = window.setTimeout(unreadable, 1500)
				samplingImage = new Image()
				samplingImage.crossOrigin = 'anonymous'
				samplingImage.decoding = 'async'
				samplingImage.onload = () => {
					if (disposed) return
					if (!samplingImage?.naturalWidth || !samplingImage.naturalHeight) unreadable()
					else {
						imageRef.current = { src, image: samplingImage }
						analyze()
					}
				}
				samplingImage.onerror = unreadable
				samplingImage.src = src
			}
			displayImage.onerror = failDisplay
			// Loading and decode share a finite budget so an unavailable wallpaper cannot
			// keep navigation/settings behind the first-presentation shell indefinitely.
			displayTimer = window.setTimeout(failDisplay, 15_000)
			displayImage.src = src
		}
		// Preview layers update immediately; defer image analysis until the slider settles.
		if (analysisDelay > 0) timer = window.setTimeout(load, analysisDelay)
		else load()
		return () => {
			disposed = true
			clearTimeout(timer)
			clearTimeout(displayTimer)
			clearTimeout(analysisTimer)
			if (displayImage) {
				displayImage.onload = null
				displayImage.onerror = null
			}
			if (samplingImage) {
				samplingImage.onload = null
				samplingImage.onerror = null
			}
		}
	}, [
		src,
		shade,
		blur,
		autoContrast,
		theme,
		viewport,
		key,
		context,
		protection,
		analysisDelay,
		preferredTone,
		preferredInk,
	])
	// Previously displayed images stay visible during reanalysis. Only the first
	// automatic-contrast presentation waits for its mask (or the bounded fallback).
	const displayReady = decodedSrc === src && (!autoContrast || sample?.src === src)
	if (!src)
		return { tone: preferredTone ?? theme, mixed: false, scrim: 0, status: 'none', backgroundTone: theme }
	if (sample?.key === key) return { ...sample, displayReady }
	if (sample?.context === context) {
		// Keep the last preview colors and status stable while dragging. Home still exposes
		// pending analysis, retaining its existing protection instead of flashing unmasked.
		return { ...sample, displayReady, status: analysisDelay > 0 ? sample.status : 'loading' }
	}
	if (
		autoContrast &&
		sample?.protection === protection &&
		(sample.status === 'ready' || sample.status === 'unreadable')
	) {
		// A viewport/theme change invalidates the analysis, not the protection already
		// shown for this image and ink. Replace it only when the new result is ready.
		return { ...sample, displayReady, status: 'loading' }
	}
	return {
		tone: preferredTone ?? (sample?.src === src ? sample.tone : theme),
		mixed: false,
		scrim: 0,
		status: 'loading',
		displayReady,
	}
}
