import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Button, Tooltip } from 'antd'
import { ArrowUpOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

export default function HomeBackToTop({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
	const { t } = useTranslation()
	const [visible, setVisible] = useState(false)
	const slotRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		let shown = false
		const update = () => {
			// Separate show/hide thresholds avoid flickering around a single scroll position.
			const next = window.scrollY > (shown ? 240 : 320)
			if (shown === next) return
			if (!next && slotRef.current?.contains(document.activeElement)) {
				// Manual scrolling may hide a focused button without activating it.
				slotRef.current
					.closest('nav')
					?.querySelector<HTMLElement>('button:not(.home-scroll-top)')
					?.focus({ preventScroll: true })
			}
			shown = next
			setVisible(next)
		}
		const frame = window.requestAnimationFrame(update)
		window.addEventListener('scroll', update, { passive: true })
		window.addEventListener('resize', update)
		window.addEventListener('pageshow', update)
		return () => {
			window.cancelAnimationFrame(frame)
			window.removeEventListener('scroll', update)
			window.removeEventListener('resize', update)
			window.removeEventListener('pageshow', update)
		}
	}, [])
	if (!visible) return null
	return (
		<div className="home-scroll-top-slot" ref={slotRef}>
			<Tooltip title={t('ui.backToTop')}>
				<Button
					className="home-scroll-top"
					aria-label={t('ui.backToTop')}
					icon={<ArrowUpOutlined aria-hidden="true" />}
					onClick={() => {
						targetRef.current?.focus({ preventScroll: true })
						window.scrollTo({
							top: 0,
							behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
						})
					}}
				/>
			</Tooltip>
		</div>
	)
}
