import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ConfigProvider, Menu, Tooltip, theme } from 'antd'
import type { MenuProps } from 'antd'
import {
	ApartmentOutlined,
	CopyOutlined,
	DeleteOutlined,
	EditOutlined,
	ExportOutlined,
	GlobalOutlined,
	BlockOutlined,
} from '@ant-design/icons'
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
		['address', t('ui.itemMenuPrimaryAddress'), item.url],
		['lan', t('iconItem.lanUrl'), item.lanUrl],
	] as const) {
		if (!url?.trim() || (key === 'lan' && url.trim() === item.url?.trim())) continue
		const disabled = !isSafeNavigationUrl(url)
		actions.set(`${key}-open`, () => onOpen(url))
		const shortcuts = [
			[
				'tab',
				t('ui.itemMenuNewTab'),
				t('ui.itemMenuNewTabShort'),
				<ExportOutlined key="tab" aria-hidden="true" />,
				() => onOpen(url, 2),
			],
			[
				'frame',
				t('ui.itemMenuFrame'),
				t('ui.itemMenuFrameShort'),
				<BlockOutlined key="frame" aria-hidden="true" />,
				() => onOpen(url, 3),
			],
			[
				'copy',
				t('ui.itemMenuCopy'),
				t('ui.itemMenuCopyShort'),
				<CopyOutlined key="copy" aria-hidden="true" />,
				() => onCopy(url),
			],
		] as const
		items.push({
			type: 'group',
			key,
			className: 'item-action-address',
			children: [
				{
					key: `${key}-open`,
					label: t('ui.itemMenuOpen', { address }),
					icon:
						key === 'address' ? (
							<GlobalOutlined aria-hidden="true" />
						) : (
							<ApartmentOutlined aria-hidden="true" />
						),
					disabled,
					className: 'item-action-primary',
					style: { paddingInline: 10 },
				},
				...shortcuts.map(([action, label, shortLabel, icon, run]) => {
					const name = `${address}：${label}`
					actions.set(`${key}-${action}`, run)
					return {
						key: `${key}-${action}`,
						disabled,
						className: 'item-action-shortcut',
						label: (
							<Tooltip title={name} mouseEnterDelay={0.6}>
								<span className="item-action-shortcut-content" aria-label={name}>
									{icon}
									<span className="item-action-label">{shortLabel}</span>
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
			{
				key: 'edit',
				icon: <EditOutlined aria-hidden="true" />,
				label: t('common.edit'),
				className: 'item-action-manage',
			},
			{
				key: 'delete',
				icon: <DeleteOutlined aria-hidden="true" />,
				label: t('common.delete'),
				danger: true,
				className: 'item-action-manage',
			},
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
			if (!(event.target instanceof Node) || !element.contains(event.target)) onClose(false)
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
				borderRadius: 14,
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
			<ConfigProvider
				theme={{
					components: {
						Menu: {
							fontSize: 13,
							itemHeight: 'var(--item-action-row-height)',
							itemMarginInline: 0,
							itemMarginBlock: 0,
							itemBorderRadius: 8,
							itemPaddingInline: 10,
							iconSize: 15,
							iconMarginInlineEnd: 8,
							itemColor: 'var(--glass-popup-text)',
							itemHoverColor: 'var(--glass-popup-text)',
							itemDisabledColor: 'color-mix(in srgb, var(--glass-popup-text) 34%, transparent)',
							itemHoverBg: 'color-mix(in srgb, var(--glass-popup-text) 6%, transparent)',
							itemActiveBg: 'color-mix(in srgb, var(--glass-popup-text) 9%, transparent)',
						},
					},
				}}
			>
				<Menu
					className="item-action-menu"
					aria-label={`${t('ui.more')} ${item.title}`}
					selectable={false}
					items={items}
					onClick={({ key }) => {
						onClose(true)
						actions.get(key)?.()
					}}
				/>
			</ConfigProvider>
		</div>,
		document.body,
	)
}
