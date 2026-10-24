import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Menu, Tooltip, theme } from 'antd'
import type { MenuProps } from 'antd'
import { CopyOutlined, DeleteOutlined, EditOutlined, ExportOutlined, BlockOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { isSafeNavigationUrl } from '@/utils/navigation'

export interface ItemMenuTarget {
	id: number
	x: number
	y: number
	trigger: HTMLElement
}

export default function ItemActionMenu({
	item,
	target,
	editable,
	onClose,
	onOpen,
	onCopy,
	onEdit,
	onDelete,
}: {
	item: Panel.ItemInfo
	target: ItemMenuTarget
	editable: boolean
	onClose: (restoreFocus: boolean) => void
	onOpen: (url: string, method?: number) => void
	onCopy: (url: string) => void
	onEdit: () => void
	onDelete: () => void
}) {
	const rootRef = useRef<HTMLDivElement>(null)
	const { token } = theme.useToken()
	const { t } = useTranslation()
	const actions = new Map<string, () => void>()
	const items: NonNullable<MenuProps['items']> = []
	for (const [key, address, url] of [
		['address', t('iconItem.url'), item.url],
		['lan', t('iconItem.lanUrl'), item.lanUrl],
	] as const) {
		if (!url?.trim()) continue
		const disabled = !isSafeNavigationUrl(url)
		actions.set(`${key}-open`, () => onOpen(url))
		const shortcuts = [
			['tab', t('ui.itemMenuNewTab'), <ExportOutlined key="tab" aria-hidden="true" />, () => onOpen(url, 2)],
			[
				'frame',
				t('ui.itemMenuFrame'),
				<BlockOutlined key="frame" aria-hidden="true" />,
				() => onOpen(url, 3),
			],
			['copy', t('ui.itemMenuCopy'), <CopyOutlined key="copy" aria-hidden="true" />, () => onCopy(url)],
		] as const
		items.push({
			type: 'group',
			key,
			className: 'item-action-address',
			children: [
				{
					key: `${key}-open`,
					label: t('ui.itemMenuOpen', { address }),
					disabled,
					className: 'item-action-open',
				},
				...shortcuts.map(([action, label, icon, run]) => {
					const name = `${address}：${label}`
					actions.set(`${key}-${action}`, run)
					return {
						key: `${key}-${action}`,
						disabled,
						className: 'item-action-shortcut',
						label: (
							<Tooltip title={name}>
								<span aria-label={name}>
									{icon}
									<span className="item-action-label">{name}</span>
								</span>
							</Tooltip>
						),
					}
				}),
			],
		})
	}
	if (editable) {
		if (items.length) items.push({ type: 'divider' })
		items.push(
			{ key: 'edit', icon: <EditOutlined aria-hidden="true" />, label: t('common.edit') },
			{ key: 'delete', icon: <DeleteOutlined aria-hidden="true" />, label: t('common.delete'), danger: true },
		)
		actions.set('edit', onEdit)
		actions.set('delete', onDelete)
	}
	useLayoutEffect(() => {
		const element = rootRef.current!
		const rect = element.getBoundingClientRect()
		element.style.left = `${Math.max(8, Math.min(target.x, innerWidth - rect.width - 8))}px`
		element.style.top = `${Math.max(8, Math.min(target.y, innerHeight - rect.height - 8))}px`
		const first = element.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
		const focusTarget = first || element.querySelector<HTMLElement>('[role="menu"]')
		focusTarget?.focus({ preventScroll: true })
		const outside = (event: Event) => {
			const toggleTarget =
				event.target instanceof Node &&
				target.trigger.matches('.item-menu') &&
				target.trigger.contains(event.target)
			if (!(event.target instanceof Node) || (!element.contains(event.target) && !toggleTarget))
				onClose(false)
		}
		const dismiss = () => onClose(false)
		document.addEventListener('pointerdown', outside, true)
		document.addEventListener('contextmenu', outside, true)
		window.addEventListener('scroll', outside, true)
		window.addEventListener('resize', dismiss)
		window.addEventListener('blur', dismiss)
		return () => {
			document.removeEventListener('pointerdown', outside, true)
			document.removeEventListener('contextmenu', outside, true)
			window.removeEventListener('scroll', outside, true)
			window.removeEventListener('resize', dismiss)
			window.removeEventListener('blur', dismiss)
		}
	}, [target, onClose])
	return createPortal(
		<div
			ref={rootRef}
			className="item-action-popup"
			style={{
				left: target.x,
				top: target.y,
				background: 'var(--glass-popup)',
				color: 'var(--glass-popup-text)',
				border: '1px solid var(--glass-popup-line)',
				boxShadow: 'var(--glass-popup-shadow)',
				backdropFilter: 'var(--glass-popup-blur)',
				WebkitBackdropFilter: 'var(--glass-popup-blur)',
				borderRadius: token.borderRadiusLG,
				zIndex: token.zIndexPopupBase + 50,
			}}
			onKeyDownCapture={(event) => {
				if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
					const choices = [
						...event.currentTarget.querySelectorAll<HTMLElement>(
							'[role="menuitem"]:not([aria-disabled="true"])',
						),
					]
					const index = choices.indexOf(document.activeElement as HTMLElement)
					choices[(index + (event.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length]?.focus()
					event.preventDefault()
					event.stopPropagation()
				}
				if (event.key === 'Escape' || event.key === 'Tab') {
					if (event.key === 'Escape') event.preventDefault()
					event.stopPropagation()
					onClose(true)
				}
			}}
		>
			<Menu
				aria-label={`${t('ui.more')} ${item.title}`}
				selectable={false}
				items={items}
				onClick={({ key }) => {
					onClose(true)
					actions.get(key)?.()
				}}
			/>
		</div>,
		document.body,
	)
}
