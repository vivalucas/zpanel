import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Alert, Button, Empty, Input, Modal, Select, Space, Tooltip } from 'antd'
import {
	AppstoreOutlined,
	GlobalOutlined,
	LoginOutlined,
	PlusOutlined,
	SearchOutlined,
	SettingOutlined,
	SwapOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { AuthInfo, Engine, Group } from '@/lib/api'
import { useGroups, usePanel, useSearchConfig } from '@/lib/queries'
import { usePreferences } from '@/app/store'
import { Loading, QueryError } from '@/components/shared'
import { SafeHtml } from '@/components/SafeHtml'
import { WallpaperBackground } from '@/components/WallpaperBackground'
import { isSafeNavigationUrl } from '@/utils/navigation'
import HomeGrid from './HomeGrid'
import ItemIcon from './ItemIcon'
import ItemTitle from './ItemTitle'
import type { ItemMenuTarget } from './ItemActionMenu'
import HomeBackToTop from './HomeBackToTop'
import { useWallpaperAppearance } from './useWallpaperAppearance'
import { findSearchEngineIndex } from '@/lib/searchEngine'
import { isAccessError } from '@/lib/queryState'
import { resolveHomeText } from '@/lib/homeText'
import { useUnverifiedHomeData } from '@/lib/useHomeCache'
import { HomeClock } from '@/components/HomeClock'
import { HomeStartupShell } from '@/components/HomeStartupShell'
import { rememberStartupTone } from '@/lib/homeStartup'
import {
	OptionalModuleBoundary,
	OptionalModuleDialog,
	OptionalModuleFailure,
} from '@/components/OptionalModuleBoundary'
const MonitorCards = lazy(() => import('./MonitorCards'))
const ItemEditor = lazy(() => import('./ItemEditor'))
const ItemActionMenu = lazy(() => import('./ItemActionMenu'))
export default function Home({ auth }: { auth: AuthInfo }) {
	const request = useSessionRequest()
	const groups = useGroups()
	const topRef = useRef<HTMLElement>(null)
	const panel = usePanel()
	const text = useMemo(
		() => resolveHomeText(panel.data?.panel.iconTextColor),
		[panel.data?.panel.iconTextColor],
	)
	const wallpaperAppearance = useWallpaperAppearance(
		panel.data?.panel.backgroundImageSrc,
		panel.data?.panel.backgroundMaskNumber ?? 0,
		panel.data?.panel.backgroundBlur ?? 0,
		panel.data?.panel.wallpaperAutoContrast ?? false,
		0,
		text.tone,
		text.ink,
	)
	const [hasPresentedHome, setHasPresentedHome] = useState(false)
	useEffect(() => {
		if (!panel.data || isAccessError(panel.error)) return
		if (wallpaperAppearance.status === 'loading') return
		rememberStartupTone(wallpaperAppearance.backgroundTone ?? 'dark')
	}, [panel.data, panel.error, wallpaperAppearance.status, wallpaperAppearance.backgroundTone])
	const searchConfig = useSearchConfig()
	const navigate = useNavigate()
	const client = useQueryClient()
	const navigationUnverified = useUnverifiedHomeData(client, 'groups')
	const searchUnverified = useUnverifiedHomeData(client, 'search')
	const { t, error, modal, message } = useFeedback()
	const preferences = usePreferences()
	const [search, setSearch] = useState('')
	const [engine, setEngine] = useState<Engine>()
	const [engineSaving, setEngineSaving] = useState(false)
	const [monitorHidden, setMonitorHidden] = useState(false)
	const [sortingGroupId, setSortingGroupId] = useState<number | null>(null)
	const sortTriggerRef = useRef<HTMLElement | null>(null)
	const [savingSort, setSavingSort] = useState(false)
	const [editor, setEditor] = useState<{ item?: Panel.ItemInfo; groupId?: number } | null>(null)
	const editorTriggerRef = useRef<HTMLElement | number | null>(null)
	const itemTriggersRef = useRef(new Map<number, HTMLElement>())
	const [itemMenu, setItemMenu] = useState<ItemMenuTarget | null>(null)
	const activeRef = useRef(true)
	const copySequenceRef = useRef(0)
	useEffect(() => {
		activeRef.current = true
		return () => {
			activeRef.current = false
		}
	}, [])
	const closeItemMenu = useCallback(
		(restoreFocus: boolean) => {
			setItemMenu(null)
			if (restoreFocus && itemMenu) {
				const trigger = itemMenu.trigger.isConnected
					? itemMenu.trigger
					: itemTriggersRef.current.get(itemMenu.id)
				trigger?.focus({ preventScroll: true })
			}
		},
		[itemMenu],
	)
	useEffect(() => {
		if (!itemMenu) return
		// Dismiss even while the menu chunk is still loading.
		const outside = (event: Event) => {
			if (document.querySelector('.optional-module-dialog')) return
			if (event.target instanceof Element && event.target.closest('.item-action-popup')) return
			closeItemMenu(false)
		}
		const dismiss = () => closeItemMenu(false)
		const escape = (event: KeyboardEvent) => {
			// A failed menu becomes a modal with its own Escape handling and focus trap.
			if (document.querySelector('.optional-module-dialog')) return
			if (event.key === 'Escape' || event.key === 'Tab') closeItemMenu(true)
			if (
				!document.querySelector('.item-action-popup') &&
				(event.key === 'Enter' || event.key === ' ') &&
				event.target instanceof Node &&
				itemMenu.trigger.contains(event.target)
			)
				event.preventDefault()
		}
		document.addEventListener('pointerdown', outside, true)
		document.addEventListener('contextmenu', outside, true)
		document.addEventListener('keydown', escape)
		window.addEventListener('scroll', outside, true)
		window.addEventListener('resize', dismiss)
		window.addEventListener('blur', dismiss)
		return () => {
			document.removeEventListener('pointerdown', outside, true)
			document.removeEventListener('contextmenu', outside, true)
			document.removeEventListener('keydown', escape)
			window.removeEventListener('scroll', outside, true)
			window.removeEventListener('resize', dismiss)
			window.removeEventListener('blur', dismiss)
		}
	}, [itemMenu, closeItemMenu])
	useEffect(() => {
		if (!editor) {
			const trigger = editorTriggerRef.current
			;(typeof trigger === 'number' ? itemTriggersRef.current.get(trigger) : trigger)?.focus()
		}
	}, [editor])
	const [frame, setFrame] = useState<{ url: string; title: string } | null>(null)
	const [navigationFailure, setNavigationFailure] = useState<unknown>()
	if (groups.error && groups.error !== navigationFailure) setNavigationFailure(groups.error)
	if (groups.isSuccess && navigationFailure) setNavigationFailure(undefined)
	const navigationError = groups.error || (!groups.data ? navigationFailure : undefined)
	const editable = auth.visitMode === 0
	const navigationAvailable = !!groups.data && !isAccessError(groups.error)
	const navigationGroups = navigationAvailable ? groups.data! : []
	if (isAccessError(groups.error) || isAccessError(panel.error)) {
		// Discard hidden interactions before committing, so recovery cannot reopen old content.
		if (editor) setEditor(null)
		if (itemMenu) setItemMenu(null)
		if (sortingGroupId !== null) setSortingGroupId(null)
		if (frame) setFrame(null)
	}
	if (panel.isPending) return <HomeStartupShell label={t('ui.loadingHome')} />
	if (!panel.data || isAccessError(panel.error))
		return (
			<HomeStartupShell>
				<QueryError error={panel.error} retry={() => panel.refetch()} compact />
			</HomeStartupShell>
		)
	// First presentation keeps a readable public palette until the wallpaper is safe
	// to show. Later revalidation must not unmount editors or other active interactions.
	if (!hasPresentedHome && wallpaperAppearance.status === 'loading' && !wallpaperAppearance.displayReady)
		return <HomeStartupShell label={t('ui.loadingHome')} />
	if (!hasPresentedHome) setHasPresentedHome(true)
	const config = panel.data.panel
	const searchData = isAccessError(searchConfig.error) ? undefined : searchConfig.data
	const engineIndex = searchData
		? findSearchEngineIndex(searchData.searchEngineList, engine || searchData.currentSearchEngine)
		: -1
	const wallpaper = wallpaperAppearance.status === 'error' ? '' : config.backgroundImageSrc
	const showEditHint = editable && navigationGroups.length > 0 && !preferences.homeEditHintDismissed
	const configSearchEnabled = config.searchBoxSearchIcon
	const filtered = navigationGroups
		.map((group) => ({
			...group,
			items: group.items.filter((item) =>
				`${item.title} ${item.description || ''} ${item.url} ${item.lanUrl || ''}`
					.toLowerCase()
					.includes((configSearchEnabled ? search : '').toLowerCase()),
			),
		}))
		.filter((group) => !configSearchEnabled || !search || group.items.length)
	const destination = (item: Panel.ItemInfo) => {
		const url = preferences.network === 'lan' ? item.lanUrl || item.url : item.url || item.lanUrl
		return url && isSafeNavigationUrl(url) ? url : undefined
	}
	const open = (item: Panel.ItemInfo, override?: string, method = item.openMethod) => {
		setItemMenu(null)
		const url =
			override ?? (preferences.network === 'lan' ? item.lanUrl || item.url : item.url || item.lanUrl)
		if (!url || !isSafeNavigationUrl(url)) return error(new Error(t('review.invalidUrl')))
		if (method === 3) setFrame({ url, title: item.title })
		else if (method === 1) location.assign(url)
		else window.open(url, '_blank', 'noopener,noreferrer')
	}
	const copyAddress = async (url: string) => {
		if (!isSafeNavigationUrl(url)) return error(new Error(t('review.invalidUrl')))
		const address = new URL(url.trim(), location.href).href
		const sequence = ++copySequenceRef.current
		try {
			await navigator.clipboard.writeText(address)
			if (activeRef.current && sequence === copySequenceRef.current)
				void message.success(t('ui.itemMenuCopied'))
		} catch {
			if (!activeRef.current || sequence !== copySequenceRef.current) return
			modal.confirm({
				title: t('ui.itemMenuManualCopy'),
				icon: null,
				content: (
					<>
						<p>{t('ui.itemMenuManualCopyHint')}</p>
						<Input
							aria-label={t('iconItem.url')}
							value={address}
							readOnly
							autoFocus
							onFocus={(event) => event.target.select()}
						/>
					</>
				),
				autoFocusButton: null,
				okText: t('common.confirm'),
				cancelButtonProps: { hidden: true },
			})
		}
	}
	const deleteItem = (item: Panel.ItemInfo) => {
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
	}
	const activeMenuItem = filtered
		.filter((group) => group.id !== sortingGroupId)
		.flatMap((group) => group.items)
		.find((item) => item.id === itemMenu?.id)
	// Discard a removed/filtered/sorted target so it cannot reopen when the list returns.
	if (itemMenu && !activeMenuItem) setItemMenu(null)
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
		<main
			className={`home-page ${wallpaper ? 'has-wallpaper' : ''} ${showEditHint ? 'show-edit-hint' : ''}`}
			data-wallpaper-tone={wallpaper ? wallpaperAppearance.tone : undefined}
			data-wallpaper-mixed={wallpaper ? wallpaperAppearance.mixed : undefined}
			data-wallpaper-status={wallpaperAppearance.status}
			data-home-text-tone={text.tone}
			style={{ '--home-text': text.color, '--wallpaper-scrim': wallpaperAppearance.scrim } as CSSProperties}
		>
			<WallpaperBackground
				src={config.backgroundImageSrc}
				shade={config.backgroundMaskNumber}
				blur={config.backgroundBlur}
				appearance={wallpaperAppearance}
			/>
			<nav className="home-tools" aria-label={t('ui.homeTools')}>
				<HomeBackToTop targetRef={topRef} />
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
			</nav>
			<div
				className="home-content"
				style={
					{
						maxWidth: `${config.maxWidth || 1200}${config.maxWidthUnit === '%' ? '%' : 'px'}`,
						'--home-margin-top': config.marginTop ?? 10,
						marginBottom: `${config.marginBottom ?? 10}%`,
						paddingInline: `${10 + (config.marginX ?? 5)}px`,
					} as CSSProperties
				}
			>
				{panel.error && (
					<QueryError
						error={panel.error}
						title={t('ui.refreshFailedWithPreviousData')}
						compact
						retry={() => panel.refetch()}
					/>
				)}
				{editable && !!panel.data.panelWarnings.length && (
					<Alert
						className="spaced"
						type="warning"
						showIcon
						title={t('review.panelRepair')}
						action={
							<Button onClick={() => navigate('/settings/appearance')}>{t('review.repairAppearance')}</Button>
						}
					/>
				)}
				<section className="home-hero">
					<div className="home-identity">
						{config.logoImageSrc && <img className="home-logo-image" src={config.logoImageSrc} alt="" />}
						<strong className="home-logo-text" ref={topRef} tabIndex={-1}>
							{config.logoText || 'ZPanel'}
						</strong>
						<span className="home-identity-divider" aria-hidden="true" />
						<HomeClock seconds={config.clockShowSecond} color={config.clockColor} />
					</div>
					{config.searchBoxShow && (
						<div className="search-box">
							<SearchOutlined aria-hidden="true" />
							<Input
								variant="borderless"
								styles={{ root: { outline: 'none' } }}
								aria-label={t('ui.search')}
								placeholder={t(configSearchEnabled ? 'ui.searchPlaceholder' : 'ui.webSearchPlaceholder')}
								value={search}
								allowClear
								onChange={(e) => {
									setItemMenu(null)
									setSearch(e.target.value)
								}}
								onPressEnter={(e) => {
									if (e.nativeEvent.isComposing || !search.trim()) return
									if (isAccessError(searchConfig.error)) return
									const selected = (engine || searchData?.currentSearchEngine)?.url
									if (!selected) return
									const url = selected.includes('%s')
										? selected.replace('%s', encodeURIComponent(search))
										: selected + encodeURIComponent(search)
									if (!isSafeNavigationUrl(url)) return error(new Error(t('review.invalidUrl')))
									if (searchData?.newWindowOpen) window.open(url, '_blank', 'noopener,noreferrer')
									else location.assign(url)
								}}
							/>
							<Select
								aria-label={t('ui.searchEngine')}
								disabled={engineSaving || !searchData || searchUnverified}
								loading={engineSaving}
								variant="borderless"
								styles={{ root: { outline: 'none' } }}
								value={engineIndex >= 0 ? engineIndex : undefined}
								onChange={async (index) => {
									const selected = searchData?.searchEngineList[index]
									if (!selected || !searchData) return
									const previous = engine
									setEngine(selected)
									if (!editable) return
									setEngineSaving(true)
									try {
										await request('/system/moduleConfig/save', {
											name: 'module-deskModuleSearchBox',
											value: { ...searchData, currentSearchEngine: selected },
										})
										await client.invalidateQueries({ queryKey: ['search'] })
									} catch (err) {
										setEngine(previous)
										error(err)
									} finally {
										setEngineSaving(false)
									}
								}}
								options={searchData?.searchEngineList.map((e, index) => ({
									label: (
										<Space>
											{e.iconSrc && <img src={e.iconSrc} width={18} height={18} alt="" />}
											{e.title}
										</Space>
									),
									value: index,
								}))}
							/>
						</div>
					)}
					{searchConfig.error && config.searchBoxShow && (
						<QueryError
							error={searchConfig.error}
							title={searchData ? t('ui.refreshFailedWithPreviousData') : undefined}
							compact
							retry={() => searchConfig.refetch()}
						/>
					)}
				</section>
				{config.systemMonitorShow &&
					!monitorHidden &&
					(editable || config.systemMonitorPublicVisitModeShow) && (
						<OptionalModuleBoundary
							fallback={
								<div className="home-navigation-state home-module-failure">
									<OptionalModuleFailure
										compact
										onCancel={() => {
											setMonitorHidden(true)
											topRef.current?.focus({ preventScroll: true })
										}}
									/>
								</div>
							}
						>
							<Suspense fallback={<Loading />}>
								<MonitorCards showTitle={config.systemMonitorShowTitle} />
							</Suspense>
						</OptionalModuleBoundary>
					)}
				{showEditHint && (
					<aside className="home-edit-hint">
						<span>{t('ui.homeEditHint')}</span>
						<Button
							type="text"
							size="small"
							onClick={() => preferences.setPreference({ homeEditHintDismissed: true })}
						>
							{t('ui.gotIt')}
						</Button>
					</aside>
				)}
				{!navigationAvailable && groups.isPending && !navigationError ? (
					<div className="home-navigation-state" aria-busy="true">
						<Loading label={t('ui.loadingNavigation')} />
					</div>
				) : !navigationAvailable ? (
					<div className="home-navigation-state">
						<QueryError error={navigationError} retry={() => groups.refetch()} compact />
					</div>
				) : null}
				{navigationAvailable && groups.error && (
					<QueryError
						error={groups.error}
						title={t('ui.refreshFailedWithPreviousData')}
						compact
						retry={() => groups.refetch()}
					/>
				)}
				{!navigationAvailable ? null : !navigationGroups.length ? (
					<div className="empty-collection">
						<Empty
							image={<AppstoreOutlined aria-hidden="true" style={{ fontSize: 36, color: 'inherit' }} />}
							description={t('ui.emptyCollection')}
						>
							{editable && (
								<Button className="home-action" onClick={() => navigate('/settings/groups')}>
									{t('ui.createFirstGroup')}
								</Button>
							)}
						</Empty>
					</div>
				) : !filtered.length ? (
					<div className="empty-collection">
						<Empty description={t('ui.noResults')} />
					</div>
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
											disabled={navigationUnverified}
											onClick={(event) => {
												editorTriggerRef.current = event.currentTarget
												setEditor({ groupId: group.id })
											}}
										/>
										<Button
											type="text"
											aria-pressed={sortingGroupId === group.id}
											size="small"
											aria-label={`${group.title} ${t(sortingGroupId === group.id ? 'common.done' : 'ui.sort')}`}
											icon={<SwapOutlined aria-hidden="true" />}
											disabled={navigationUnverified || savingSort || group.items.length < 2}
											onClick={(event) => {
												sortTriggerRef.current = event.currentTarget
												setSortingGroupId(sortingGroupId === group.id ? null : group.id)
												setSearch('')
											}}
										/>
									</Space>
								)}
							</div>
							<HomeGrid
								sorting={sortingGroupId === group.id}
								onCancel={() => {
									setSortingGroupId(null)
									sortTriggerRef.current?.focus({ preventScroll: true })
								}}
								className={`app-grid ${config.iconStyle === 1 ? 'icon-grid' : ''}`}
								items={group.items as (Panel.ItemInfo & { id: number })[]}
								getItemLabel={(item) => item.title}
								disabled={sortingGroupId !== group.id || savingSort || !!search}
								onSort={(sorted) => void saveSort(group, sorted)}
							>
								{(item) => (
									<article
										className="navigation-card"
										onContextMenu={(event) => {
											if (event.shiftKey) {
												closeItemMenu(false)
												return
											}
											if (sortingGroupId === group.id) return
											event.preventDefault()
											const trigger = event.currentTarget.querySelector<HTMLElement>('.app-link')!
											const rect = trigger.getBoundingClientRect()
											setItemMenu({
												id: item.id!,
												trigger,
												x: event.clientX || rect.left,
												y: event.clientY || rect.bottom,
											})
										}}
										onKeyDown={(event) => {
											if (
												sortingGroupId === group.id ||
												!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
											)
												return
											event.preventDefault()
											const trigger = event.target as HTMLElement
											const rect = trigger.getBoundingClientRect()
											setItemMenu({ id: item.id!, trigger, x: rect.left, y: rect.bottom })
										}}
									>
										<a
											className="app-link"
											ref={(node) => {
												if (node) itemTriggersRef.current.set(item.id!, node)
												else itemTriggersRef.current.delete(item.id!)
											}}
											href={destination(item)}
											target={item.openMethod === 2 ? '_blank' : undefined}
											rel="noopener noreferrer"
											onClick={(event) => {
												if (sortingGroupId === group.id) {
													event.preventDefault()
													return
												}
												if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
													event.preventDefault()
													open(item)
												}
											}}
											onAuxClick={(event) => {
												if (sortingGroupId === group.id) event.preventDefault()
											}}
											aria-disabled={sortingGroupId === group.id}
											aria-label={item.title}
											tabIndex={0}
											aria-haspopup={sortingGroupId === group.id ? undefined : 'menu'}
											aria-expanded={sortingGroupId === group.id ? undefined : activeMenuItem?.id === item.id}
										>
											<ItemIcon key={item.icon?.src} item={item} />
											<div className="app-copy">
												{!(config.iconStyle === 1 && config.iconTextIconHideTitle) && (
													<ItemTitle title={item.title} />
												)}
												{config.iconStyle !== 1 &&
													!config.iconTextInfoHideDescription &&
													item.description && <span>{item.description}</span>}
											</div>
										</a>
									</article>
								)}
							</HomeGrid>
							{!group.items.length && (
								<div className="empty-group">
									<span className="empty-group-message">{t('ui.emptyGroup')}</span>
									{editable && (
										<Space wrap>
											<Button
												className="home-action"
												icon={<PlusOutlined aria-hidden="true" />}
												disabled={navigationUnverified}
												onClick={(event) => {
													editorTriggerRef.current = event.currentTarget
													setEditor({ groupId: group.id })
												}}
											>
												{t('review.firstApp')}
											</Button>
										</Space>
									)}
								</div>
							)}
						</section>
					))
				)}
				<footer className="home-footer">
					<SafeHtml className="home-footer-content" html={config.footerHtml} />
				</footer>
			</div>
			{itemMenu && activeMenuItem && !editor && !frame && (
				<OptionalModuleBoundary
					fallback={<OptionalModuleDialog title={t('ui.more')} onCancel={() => closeItemMenu(true)} />}
				>
					<Suspense fallback={null}>
						<ItemActionMenu
							item={activeMenuItem}
							target={itemMenu}
							editable={editable && !navigationUnverified}
							onClose={closeItemMenu}
							onOpen={(url, method) => open(activeMenuItem, url, method)}
							onCopy={(url) => void copyAddress(url)}
							onEdit={() => {
								if (!editable || navigationUnverified) return
								editorTriggerRef.current = activeMenuItem.id!
								setEditor({ item: activeMenuItem })
							}}
							onDelete={() => {
								if (editable && !navigationUnverified) deleteItem(activeMenuItem)
							}}
						/>
					</Suspense>
				</OptionalModuleBoundary>
			)}
			{editor && navigationAvailable && (
				<OptionalModuleBoundary
					fallback={
						<OptionalModuleDialog
							title={t(editor.item ? 'common.edit' : 'iconItem.add')}
							onCancel={() => setEditor(null)}
						/>
					}
				>
					<Suspense
						fallback={
							<Modal
								open
								title={t(editor.item ? 'common.edit' : 'iconItem.add')}
								footer={<Button onClick={() => setEditor(null)}>{t('common.cancel')}</Button>}
								onCancel={() => setEditor(null)}
								focusTriggerAfterClose={false}
							>
								<Loading />
							</Modal>
						}
					>
						<ItemEditor {...editor} groups={navigationGroups} onClose={() => setEditor(null)} />
					</Suspense>
				</OptionalModuleBoundary>
			)}
			<Modal
				open={!!frame && navigationAvailable}
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
				{frame && navigationAvailable && (
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
