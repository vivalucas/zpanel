import { useLayoutEffect, useState } from 'react'

interface WallpaperViewport {
	width: number
	height: number
}

export function useWallpaperViewport() {
	const [viewport, setViewport] = useState<WallpaperViewport>()
	useLayoutEffect(() => {
		// Scrollbar gutters can shrink fixed layers without changing innerWidth or clientWidth.
		const probe = document.createElement('div')
		probe.setAttribute('aria-hidden', 'true')
		probe.style.cssText =
			'position:fixed;inset:0;display:block;width:auto;height:auto;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none;'
		document.body.appendChild(probe)
		let disposed = false
		let timer = 0
		const measure = () => {
			if (disposed) return
			const bounds = probe.getBoundingClientRect()
			const width = Math.max(1, bounds.width)
			const height = Math.max(1, bounds.height)
			setViewport((previous) =>
				previous?.width === width && previous.height === height ? previous : { width, height },
			)
		}
		const schedule = () => {
			if (disposed) return
			clearTimeout(timer)
			timer = window.setTimeout(measure, 120)
		}
		const observer = new ResizeObserver(schedule)
		observer.observe(probe)
		window.addEventListener('resize', schedule)
		queueMicrotask(measure)
		return () => {
			disposed = true
			clearTimeout(timer)
			observer.disconnect()
			window.removeEventListener('resize', schedule)
			probe.remove()
		}
	}, [])
	return viewport
}
