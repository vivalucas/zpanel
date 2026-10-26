import { useMemo, useState } from 'react'
import { theme } from 'antd'
import { Icon } from '@iconify/react'
import { iconForeground } from '@/lib/iconColor'

type IconItem = Pick<Panel.ItemInfo, 'icon' | 'title'>

function IconContent({ item }: { item: IconItem }) {
	const [failed, setFailed] = useState(false)
	const icon = item.icon
	if (icon?.itemType === 2 && icon.src && !failed)
		return <img src={icon.src} alt="" loading="lazy" onError={() => setFailed(true)} />
	if (icon?.itemType === 3 && icon.text) return <Icon icon={icon.text} width={35} />
	return <span>{(icon?.itemType === 1 && icon.text) || item.title.slice(0, 2).toUpperCase()}</span>
}

export default function ItemIcon({ item, tone }: { item: IconItem; tone?: 'light' | 'dark' }) {
	const icon = item.icon
	const { token } = theme.useToken()
	const backdrop = tone ? (tone === 'light' ? '#fafbfd' : '#0a0f17') : token.colorBgLayout
	const foreground = useMemo(
		() => iconForeground(icon?.backgroundColor, backdrop),
		[icon?.backgroundColor, backdrop],
	)
	return (
		<span className="item-icon" style={{ background: icon?.backgroundColor || undefined, color: foreground }}>
			<IconContent key={`${icon?.itemType}:${icon?.src || ''}`} item={item} />
		</span>
	)
}
