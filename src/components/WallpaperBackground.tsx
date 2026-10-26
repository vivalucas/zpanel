import type { WallpaperState } from '@/features/home/useWallpaperAppearance'
import { wallpaperShadeColor, wallpaperVeilColors } from '@/lib/wallpaper'

interface WallpaperBackgroundProps {
	src?: string
	shade?: number
	blur?: number
	appearance: WallpaperState
	preview?: boolean
	scale?: number
}

export function WallpaperBackground({
	src,
	shade = 0,
	blur = 0,
	appearance,
	preview = false,
	scale = 1,
}: WallpaperBackgroundProps) {
	const visible = !!src && appearance.status !== 'error' && appearance.status !== 'none'
	const radius = Math.max(0, blur) * scale
	return (
		<>
			<div
				className={preview ? 'wallpaper-preview-image' : 'home-background'}
				aria-hidden="true"
				style={
					visible
						? {
								backgroundImage: `url(${JSON.stringify(src)})`,
								backgroundColor: 'var(--wallpaper-base)',
								filter: `blur(${radius}px)`,
								inset: `${-2 * radius}px`,
							}
						: undefined
				}
			/>
			{visible && (
				<>
					<div
						className={preview ? 'wallpaper-preview-shade' : 'home-mask'}
						aria-hidden="true"
						style={{ background: wallpaperShadeColor(shade) }}
					/>
					<div
						className={preview ? 'wallpaper-preview-contrast' : 'home-contrast-mask'}
						aria-hidden="true"
						style={{
							background: `rgba(${wallpaperVeilColors[appearance.tone].join(',')},${appearance.scrim})`,
						}}
					/>
				</>
			)}
		</>
	)
}
