import { Tooltip } from 'antd'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export default function ItemTitle({ title }: { title: string }) {
	const titleRef = useRef<HTMLElement>(null)
	const [truncated, setTruncated] = useState(false)
	const measure = useCallback(() => {
		const element = titleRef.current
		if (element) setTruncated(element.scrollWidth > element.clientWidth)
	}, [])

	useLayoutEffect(() => {
		const element = titleRef.current
		if (!element) return
		measure()
		const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
		observer?.observe(element)
		if (!observer) window.addEventListener('resize', measure)
		document.fonts.addEventListener('loadingdone', measure)
		return () => {
			observer?.disconnect()
			if (!observer) window.removeEventListener('resize', measure)
			document.fonts.removeEventListener('loadingdone', measure)
		}
	}, [title, measure])

	return (
		<Tooltip title={truncated ? title : undefined} trigger="hover" mouseLeaveDelay={0} destroyOnHidden>
			<strong ref={titleRef} onMouseEnter={measure}>
				{title}
			</strong>
		</Tooltip>
	)
}
