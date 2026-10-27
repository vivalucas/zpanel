import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchOutlined } from '@ant-design/icons'
import { WallpaperBackground } from '@/components/WallpaperBackground'
import { useWallpaperAppearance } from '@/features/home/useWallpaperAppearance'
import { useWallpaperViewport } from '@/features/home/useWallpaperViewport'
import { resolveHomeText } from '@/lib/homeText'

interface WallpaperPreviewProps {
	src?: string
	shade: number
	blur: number
	autoContrast: boolean
	title?: string
	textColor?: string
}

export default function WallpaperPreview({
	src,
	shade,
	blur,
	autoContrast,
	title,
	textColor,
}: WallpaperPreviewProps) {
	const { t } = useTranslation()
	const text = useMemo(() => resolveHomeText(textColor), [textColor])
	const appearance = useWallpaperAppearance(src, shade, blur, autoContrast, 160, text.tone, text.ink)
	const frameRef = useRef<HTMLDivElement>(null)
	const [availableWidth, setAvailableWidth] = useState(0)
	const viewport = useWallpaperViewport()
	useEffect(() => {
		const frame = frameRef.current
		if (!frame) return
		const measure = () => {
			setAvailableWidth(frame.clientWidth)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(frame)
		window.addEventListener('resize', measure)
		return () => {
			observer.disconnect()
			window.removeEventListener('resize', measure)
		}
	}, [])
	const viewportWidth = viewport?.width ?? 1
	const viewportHeight = viewport?.height ?? 1
	const scale = Math.min((availableWidth || 1) / viewportWidth, 220 / viewportHeight, 1)
	const hasWallpaper = !!src && appearance.status !== 'error'
	const status =
		appearance.status === 'loading'
			? 'ui.wallpaperPreviewLoading'
			: appearance.status === 'error'
				? 'ui.wallpaperPreviewFailed'
				: appearance.status === 'unreadable'
					? autoContrast && appearance.scrim > 0
						? 'ui.wallpaperPreviewAutoFallback'
						: 'ui.wallpaperPreviewUnanalyzed'
					: autoContrast && appearance.scrim > 0
						? 'ui.wallpaperPreviewAdjusted'
						: undefined
	return (
		<div className="wallpaper-preview-section">
			<div className="wallpaper-preview-frame" ref={frameRef}>
				<div
					className={`wallpaper-preview ${hasWallpaper ? 'has-wallpaper' : ''}`}
					data-wallpaper-tone={hasWallpaper ? appearance.tone : undefined}
					data-wallpaper-mixed={hasWallpaper ? appearance.mixed : undefined}
					data-wallpaper-status={appearance.status}
					data-home-text-tone={text.tone}
					style={
						{
							width: viewportWidth * scale,
							height: viewportHeight * scale,
							'--home-text': text.color,
						} as CSSProperties
					}
					aria-hidden="true"
				>
					<WallpaperBackground
						src={src}
						shade={shade}
						blur={blur}
						appearance={appearance}
						preview
						scale={scale}
					/>
					<div className="wallpaper-preview-content">
						<strong className="wallpaper-preview-title" title={title || 'ZPanel'}>
							{title || 'ZPanel'}
						</strong>
						<div className="wallpaper-preview-search">
							<SearchOutlined />
							<span>{t('ui.search')}</span>
						</div>
						<div className="wallpaper-preview-apps">
							{['W', 'Z'].map((letter) => (
								<div className="wallpaper-preview-app" key={letter}>
									<span className="wallpaper-preview-icon">{letter}</span>
									<span className="wallpaper-preview-name">
										{letter === 'W' ? t('ui.wallpaperPreviewApp') : 'ZPanel'}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
			<p className="wallpaper-preview-note">{t('ui.wallpaperPreviewDescription')}</p>
			<p className="wallpaper-preview-note wallpaper-preview-status" role="status" aria-live="polite">
				{[
					'wallpaperPreviewLoading',
					'wallpaperPreviewFailed',
					'wallpaperPreviewUnanalyzed',
					'wallpaperPreviewAutoFallback',
					'wallpaperPreviewAdjusted',
				].map((key) => (
					<span className="wallpaper-preview-status-size" aria-hidden="true" key={key}>
						{t(`ui.${key}`)}
					</span>
				))}
				<span>{status ? t(status) : null}</span>
			</p>
		</div>
	)
}
