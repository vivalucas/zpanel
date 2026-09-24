import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { lazy, Suspense, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Button, Dropdown, Empty, Input, Modal, Select, Space, Tooltip } from 'antd'
import {
	AppstoreOutlined,
	DownOutlined,
	EllipsisOutlined,
	GlobalOutlined,
	LoginOutlined,
	PlusOutlined,
	SearchOutlined,
	SettingOutlined,
	SwapOutlined,
} from '@ant-design/icons'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthInfo, Group } from '@/lib/api'
import { useGroups, usePanel, useSearchConfig } from '@/lib/queries'
import { usePreferences } from '@/app/store'
import { Loading, QueryError } from '@/components/shared'
import { SafeHtml } from '@/components/SafeHtml'
import { SortableGrid } from '@/components/Sortable'
import { isSafeNavigationUrl } from '@/utils/navigation'
import ItemEditor from './ItemEditor'
const MonitorCards = lazy(() => import('./MonitorCards'))
function Clock({ seconds, color }: { seconds?: boolean; color?: string }) {
	const [now, setNow] = useState(() => new Date())
	const language = usePreferences((s) => s.language)
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 1000)
		return () => clearInterval(timer)
	}, [])
	return (
		<div className="clock" style={{ color: color || undefined }}>
			<time>
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
export function ItemIcon({ item }: { item: Panel.ItemInfo }) {
	const icon = item.icon
	const [failed, setFailed] = useState(false)
	return (
		<span className="item-icon" style={{ background: icon?.backgroundColor || undefined }}>
			{icon?.itemType === 2 && icon.src && !failed ? (
				<img src={icon.src} alt="" loading="lazy" onError={() => setFailed(true)} />
			) : icon?.itemType === 3 && icon.text ? (
				<Icon icon={icon.text} width={35} />
			) : (
				<span>{(icon?.itemType === 1 && icon.text) || item.title.slice(0, 2).toUpperCase()}</span>
			)}
		</span>
	)
}
export default function Home({ auth }: { auth: AuthInfo }) {
	const request = useSessionRequest()
	const groups = useGroups()
	const panel = usePanel()
	const searchConfig = useSearchConfig()
	const navigate = useNavigate()
	const client = useQueryClient()
	const { t, error, modal, message } = useFeedback()
	const preferences = usePreferences()
	const [search, setSearch] = useState('')
	const [engine, setEngine] = useState<string>()
	const [engineSaving, setEngineSaving] = useState(false)
	const [sortingGroupId, setSortingGroupId] = useState<number | null>(null)
	const [savingSort, setSavingSort] = useState(false)
	const [editor, setEditor] = useState<{ item?: Panel.ItemInfo; groupId?: number } | null>(null)
	const [frame, setFrame] = useState<{ url: string; title: string } | null>(null)
	const editable = auth.visitMode === 0
	if (panel.isPending || groups.isPending) return <Loading />
	if (panel.error || groups.error)
		return (
			<div className="error-page">
				<QueryError
					error={panel.error || groups.error}
					retry={() => {
						void panel.refetch()
						void groups.refetch()
					}}
				/>
			</div>
		)
	const config = panel.data.panel
	const wallpaper = config.backgroundImageSrc
	const homeTextColor =
		config.iconTextColor?.trim().toLowerCase() === '#1f2937' ? undefined : config.iconTextColor || undefined
	const configSearchEnabled = config.searchBoxSearchIcon
	const filtered = (groups.data || [])
		.map((group) => ({
			...group,
			items: group.items.filter((item) =>
				`${item.title} ${item.description || ''} ${item.url}`
					.toLowerCase()
					.includes((configSearchEnabled ? search : '').toLowerCase()),
			),
		}))
		.filter((group) => !configSearchEnabled || !search || group.items.length)
	const open = (item: Panel.ItemInfo, override?: string) => {
		const url =
			override || (preferences.network === 'lan' ? item.lanUrl || item.url : item.url || item.lanUrl)
		if (!url || !isSafeNavigationUrl(url)) return error(new Error(t('review.invalidUrl')))
		if (item.openMethod === 3) setFrame({ url, title: item.title })
		else if (item.openMethod === 1) location.assign(url)
		else window.open(url, '_blank', 'noopener,noreferrer')
	}
	const menu = (item: Panel.ItemInfo) => ({
		items: [
			{ key: 'wan', label: t('panelHome.openWanUrl'), disabled: !item.url },
			{ key: 'lan', label: t('panelHome.openLanUrl'), disabled: !item.lanUrl },
			...(editable
				? [
						{ type: 'divider' as const },
						{ key: 'edit', label: t('common.edit') },
						{ key: 'delete', label: t('common.delete'), danger: true },
					]
				: []),
		],
		onClick: ({ key }: { key: string }) => {
			if (key === 'edit') setEditor({ item })
			else if (key === 'delete')
				modal.confirm({
					title: t('ui.deleteItem'),
					content: item.title,
					okButtonProps: { danger: true },
					onOk: async () => {
						try {
							await request('/panel/itemIcon/deletes', { ids: [item.id] })
							await client.invalidateQueries({ queryKey: ['groups'] })
						} catch (err) {
							error(err)
							throw err
						}
					},
				})
			else open(item, key === 'lan' ? item.lanUrl : item.url)
		},
	})
	const saveSort = async (group: Group, sorted: (Panel.ItemInfo & { id: number })[]) => {
		setSavingSort(true)
		try {
			await request('/panel/itemIcon/saveSort', {
				itemIconGroupId: group.id,
				sortItems: sorted.map((item, sort) => ({ id: item.id, sort })),
			})
			await client.invalidateQueries({ queryKey: ['groups'] })
			void message.success(t('common.success'))
		} catch (err) {
			error(err)
		} finally {
			setSavingSort(false)
		}
	}
	return (
		<main className={`home-page ${wallpaper ? 'has-wallpaper' : ''}`}>
			<div
				className="home-background"
				style={
					wallpaper
						? {
								backgroundImage: `url(${JSON.stringify(wallpaper)})`,
								filter: `blur(${config.backgroundBlur || 0}px)`,
							}
						: undefined
				}
			/>
			{wallpaper && (
				<div
					className="home-mask"
					style={{
						background: `rgba(10,15,30,${Math.max(0, Math.min(1, config.backgroundMaskNumber || 0))})`,
					}}
				/>
			)}
			<div className="home-tools">
				{config.netModeChangeButtonShow && (
					<Tooltip
						title={t(
							preferences.network === 'wan' ? 'panelHome.changeToLanModel' : 'panelHome.changeToWanModel',
						)}
					>
						<Button
							aria-label={preferences.network === 'wan' ? t('ui.wan') : t('ui.lan')}
							icon={<GlobalOutlined aria-hidden="true" />}
							onClick={() =>
								preferences.setPreference({ network: preferences.network === 'wan' ? 'lan' : 'wan' })
							}
						/>
					</Tooltip>
				)}
				{editable ? (
					<Tooltip title={t('ui.settings')}>
						<Button
							aria-label={t('ui.settings')}
							icon={<SettingOutlined aria-hidden="true" />}
							onClick={() => navigate('/settings/appearance')}
						/>
					</Tooltip>
				) : (
					<Tooltip title={t('login.loginButton')}>
						<Button
							aria-label={t('login.loginButton')}
							icon={<LoginOutlined aria-hidden="true" />}
							onClick={() => navigate('/login', { state: { fromPublicHome: true } })}
						/>
					</Tooltip>
				)}
			</div>
			<div
				className="home-content"
				style={
					{
						maxWidth: `${config.maxWidth || 1200}${config.maxWidthUnit === '%' ? '%' : 'px'}`,
						marginTop: `${config.marginTop ?? 10}%`,
						marginBottom: `${config.marginBottom ?? 10}%`,
						paddingInline: `${10 + (config.marginX ?? 5)}px`,
						'--home-text': homeTextColor,
					} as CSSProperties
				}
			>
				<section className="home-hero">
					<div className="home-identity">
						{config.logoImageSrc && <img className="home-logo-image" src={config.logoImageSrc} alt="" />}
						<strong className="home-logo-text">{config.logoText || 'ZPanel'}</strong>
						<span className="home-identity-divider" aria-hidden="true">
							|
						</span>
						<Clock seconds={config.clockShowSecond} color={config.clockColor} />
					</div>
					{config.searchBoxShow && (
						<div className="search-box">
							<SearchOutlined aria-hidden="true" />
							<Input
								variant="borderless"
								aria-label={t('ui.search')}
								placeholder={t(configSearchEnabled ? 'ui.searchPlaceholder' : 'ui.webSearchPlaceholder')}
								value={search}
								allowClear
								onChange={(e) => setSearch(e.target.value)}
								onPressEnter={(e) => {
									if (e.nativeEvent.isComposing || !search.trim()) return
									const selected = engine || searchConfig.data?.currentSearchEngine.url
									if (!selected) return
									const url = selected.includes('%s')
										? selected.replace('%s', encodeURIComponent(search))
										: selected + encodeURIComponent(search)
									if (!isSafeNavigationUrl(url)) return error(new Error(t('review.invalidUrl')))
									if (searchConfig.data?.newWindowOpen) window.open(url, '_blank', 'noopener,noreferrer')
									else location.assign(url)
								}}
							/>
							<Select
								aria-label={t('ui.searchEngine')}
								suffixIcon={
									wallpaper ? <DownOutlined style={{ color: '#fff' }} aria-hidden="true" /> : undefined
								}
								disabled={engineSaving}
								loading={engineSaving}
								variant="borderless"
								value={engine || searchConfig.data?.currentSearchEngine.url}
								onChange={async (url) => {
									setEngine(url)
									if (!editable || !searchConfig.data) return
									const selected = searchConfig.data.searchEngineList.find((e) => e.url === url)
									if (!selected) return
									setEngineSaving(true)
									try {
										await request('/system/moduleConfig/save', {
											name: 'module-deskModuleSearchBox',
											value: { ...searchConfig.data, currentSearchEngine: selected },
										})
										await client.invalidateQueries({ queryKey: ['search'] })
									} catch (err) {
										error(err)
									} finally {
										setEngineSaving(false)
									}
								}}
								options={searchConfig.data?.searchEngineList.map((e) => ({
									label: (
										<Space>
											{e.iconSrc && <img src={e.iconSrc} width={18} height={18} alt="" />}
											{e.title}
										</Space>
									),
									value: e.url,
								}))}
							/>
						</div>
					)}
					{searchConfig.error && config.searchBoxShow && (
						<QueryError error={searchConfig.error} retry={() => searchConfig.refetch()} />
					)}
				</section>
				{config.systemMonitorShow && (editable || config.systemMonitorPublicVisitModeShow) && (
					<Suspense fallback={<Loading />}>
						<MonitorCards showTitle={config.systemMonitorShowTitle} />
					</Suspense>
				)}
				{!groups.data.length ? (
					<div className="empty-collection">
						<Empty
							image={
								<AppstoreOutlined aria-hidden="true" style={{ fontSize: 44, color: 'var(--primary)' }} />
							}
							description={t('ui.emptyCollection')}
						>
							{editable && (
								<Button type="primary" onClick={() => navigate('/settings/groups')}>
									{t('ui.createFirstGroup')}
								</Button>
							)}
						</Empty>
					</div>
				) : !filtered.length ? (
					<Empty description={t('ui.noResults')} />
				) : (
					filtered.map((group) => (
						<section
							className={`navigation-group ${sortingGroupId === group.id ? 'is-sorting' : ''}`}
							key={group.id}
						>
							<div className="group-heading">
								<h2>{group.title}</h2>
								{editable && (
									<Space className="group-actions">
										<Button
											type="text"
											size="small"
											aria-label={`${group.title} ${t('iconItem.add')}`}
											icon={<PlusOutlined aria-hidden="true" />}
											onClick={() => setEditor({ groupId: group.id })}
										/>
										<Button
											type={sortingGroupId === group.id ? 'primary' : 'text'}
											size="small"
											aria-label={`${group.title} ${t(sortingGroupId === group.id ? 'common.done' : 'ui.sort')}`}
											icon={<SwapOutlined aria-hidden="true" />}
											disabled={savingSort || group.items.length < 2}
											onClick={() => {
												setSortingGroupId(sortingGroupId === group.id ? null : group.id)
												setSearch('')
											}}
										/>
									</Space>
								)}
							</div>
							<SortableGrid
								className={`app-grid ${config.iconStyle === 1 ? 'icon-grid' : ''}`}
								items={group.items as (Panel.ItemInfo & { id: number })[]}
								disabled={sortingGroupId !== group.id || savingSort || !!search}
								onSort={(sorted) => void saveSort(group, sorted)}
							>
								{(item) => (
									<Dropdown
										menu={menu(item)}
										trigger={['contextMenu']}
										disabled={sortingGroupId === group.id}
									>
										<article className="navigation-card">
											<button
												className="app-link"
												onClick={() => {
													if (sortingGroupId !== group.id) open(item)
												}}
												aria-disabled={sortingGroupId === group.id}
												aria-label={item.title}
											>
												<ItemIcon key={item.icon?.src} item={item} />
												<div className="app-copy">
													{!(config.iconStyle === 1 && config.iconTextIconHideTitle) && (
														<strong>{item.title}</strong>
													)}
													{config.iconStyle !== 1 &&
														!config.iconTextInfoHideDescription &&
														item.description && <span>{item.description}</span>}
												</div>
											</button>
											{sortingGroupId !== group.id && (
												<Dropdown menu={menu(item)} trigger={['click']}>
													<Button
														className="item-menu"
														type="text"
														size="small"
														aria-label={`${t('ui.more')} ${item.title}`}
														icon={<EllipsisOutlined aria-hidden="true" />}
													/>
												</Dropdown>
											)}
										</article>
									</Dropdown>
								)}
							</SortableGrid>
							{!group.items.length && <div className="empty-group">{t('ui.emptyGroup')}</div>}
						</section>
					))
				)}
				<SafeHtml className="home-footer" html={config.footerHtml} />
			</div>
			{editor && <ItemEditor {...editor} groups={groups.data} onClose={() => setEditor(null)} />}
			<Modal
				open={!!frame}
				title={frame?.title}
				footer={null}
				width="90vw"
				onCancel={() => setFrame(null)}
				destroyOnHidden
			>
				<p className="muted">
					{t('ui.frameHint')}{' '}
					<a href={frame?.url} target="_blank" rel="noopener noreferrer">
						{t('iconItem.newWindowOpen')}
					</a>
				</p>
				{frame && (
					<iframe
						className="app-frame"
						src={frame.url}
						title={frame.title}
						sandbox={
							new URL(frame.url, location.href).origin === location.origin
								? 'allow-scripts allow-forms allow-popups allow-downloads'
								: 'allow-scripts allow-forms allow-same-origin allow-popups allow-downloads'
						}
						referrerPolicy="no-referrer"
					/>
				)}
			</Modal>
		</main>
	)
}
