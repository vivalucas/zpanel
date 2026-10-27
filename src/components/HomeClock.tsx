import { useEffect, useState } from 'react'
import { usePreferences } from '@/app/store'

export function HomeClock({ seconds, color }: { seconds?: boolean; color?: string }) {
	const [now, setNow] = useState(() => new Date())
	const language = usePreferences((state) => state.language)
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 1000)
		return () => clearInterval(timer)
	}, [])
	return (
		<div className="clock" style={{ color: color || undefined }}>
			<time dateTime={now.toISOString()}>
				{now.toLocaleTimeString(language, {
					hour: '2-digit',
					minute: '2-digit',
					...(seconds ? { second: '2-digit' } : {}),
					hour12: false,
				})}
			</time>
			<span>{now.toLocaleDateString(language, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
		</div>
	)
}
