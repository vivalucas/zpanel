import { lazy, Suspense, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import {
	createHashRouter,
	createRoutesFromElements,
	RouterProvider,
	Outlet,
	Navigate,
	Route,
	useLocation,
	useRouteError,
} from 'react-router-dom'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuth, useSite } from '@/lib/queries'
import { ApiError } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { clearUnverifiedHomeData } from '@/lib/homeCache'
import type { AuthInfo } from '@/lib/api'
import { usePreferences } from './store'
import { Loading, QueryError, StatusState } from '@/components/shared'
import defaultSiteIcon from '@/assets/logo.svg?no-inline'
import { HomeStartupShell } from '@/components/HomeStartupShell'
const Login = lazy(() => import('@/features/auth/Login'))
const loadHome = () => import('@/features/home/Home')
const loadSettings = () => import('@/features/settings/Settings')

let executedCustomJs: string | undefined
let hasExecutedCustomJs = false
function SiteCustomization() {
	const site = useSite().data?.siteSetting
	const route = useLocation()
	const siteTitle = site?.siteTitle
	const siteIcon = site?.siteIcon
	const safe = [location.search, route.search].some((query) => {
		const p = new URLSearchParams(query)
		return p.get('safeMode') === '1' || p.get('zpanelSafeMode') === '1'
	})
	useEffect(() => {
		document.title = siteTitle || 'ZPanel'
		const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
		// Resolve stored default paths to the same fingerprinted logo used by the HTML entry.
		if (icon) {
			icon.href =
				!siteIcon || ['/favicon.svg', '/favicon.ico'].includes(siteIcon) ? defaultSiteIcon : siteIcon
			icon.removeAttribute('type')
		}
	}, [siteTitle, siteIcon])
	useEffect(() => {
		if (safe) return
		const style = document.createElement('style')
		style.id = 'zpanel-custom-css'
		style.textContent = site?.customCss || ''
		document.head.append(style)
		return () => style.remove()
	}, [safe, site?.customCss])
	useEffect(() => {
		// Removing a script tag cannot undo listeners/timers installed by custom code.
		if (safe) {
			if (hasExecutedCustomJs) location.reload()
			return
		}
		if (site?.customJs === undefined || executedCustomJs === site.customJs) return
		executedCustomJs = site.customJs
		if (!site.customJs) return
		hasExecutedCustomJs = true
		const script = document.createElement('script')
		script.id = 'zpanel-custom-js'
		script.textContent = site.customJs
		document.body.append(script)
		script.remove()
	}, [safe, site?.customJs])
	return null
}
function Protected({ settings = false }: { settings?: boolean }) {
	const { t } = useTranslation()
	const auth = useAuth(!settings)
	const client = useQueryClient()
	const location = useLocation()
	const { token, forgetAccount } = usePreferences()
	const [loadedRoute, setLoadedRoute] = useState<
		{ settings: boolean } & ({ Page: ComponentType<{ auth: AuthInfo }> } | { error: unknown })
	>()
	useEffect(() => {
		let active = true
		// Route code is public; load it alongside authentication without reading account data.
		// Only reveal code-load failures after access is established.
		void (settings ? loadSettings() : loadHome())
			.then(({ default: Page }) => {
				if (active) {
					if (settings) clearUnverifiedHomeData(client)
					setLoadedRoute({ settings, Page })
				}
			})
			.catch((error: unknown) => {
				if (active) setLoadedRoute({ settings, error })
			})
		return () => {
			active = false
		}
	}, [settings, client])
	useEffect(() => {
		if (token && auth.data?.visitMode === 1) forgetAccount(token)
	}, [auth.data?.visitMode, token, forgetAccount])
	const pending = (label: string) =>
		settings ? <Loading label={label} /> : <HomeStartupShell label={label} />
	if (auth.isPending) return pending(t('ui.checkingAccess'))
	if (auth.error) {
		if (auth.error instanceof ApiError && [1000, 1001, 1004].includes(auth.error.code))
			return <Navigate to="/login" replace state={{ from: location.pathname }} />
		if (!settings)
			return (
				<HomeStartupShell>
					<QueryError error={auth.error} retry={() => auth.refetch()} compact />
				</HomeStartupShell>
			)
		return (
			<div className="error-page">
				<QueryError error={auth.error} retry={() => auth.refetch()} />
			</div>
		)
	}
	if (settings && auth.data.visitMode !== 0) return <Navigate to="/login" replace />
	// A ready component avoids suspending again on an already-downloaded import promise.
	if (loadedRoute?.settings !== settings) return pending(t('ui.loadingHome'))
	if ('error' in loadedRoute) {
		if (settings) throw loadedRoute.error
		return (
			<HomeStartupShell>
				<StatusState
					error
					compact
					title={t('ui.contentUnavailable')}
					description={t('ui.optionalModuleRefreshHint')}
					action={<Button onClick={() => window.location.reload()}>{t('ui.refreshPage')}</Button>}
				/>
			</HomeStartupShell>
		)
	}
	const Page = loadedRoute.Page
	return (
		<Suspense fallback={pending(t('ui.loadingHome'))}>
			<Page auth={auth.data} />
		</Suspense>
	)
}
function NotFound() {
	const { t } = useTranslation()
	return (
		<StatusState
			title="404"
			description={t('exception.pageNotFound')}
			action={<Button href="#/">{t('exception.goHome')}</Button>}
		/>
	)
}
function RouteError() {
	const { t } = useTranslation()
	const failure = useRouteError()
	useEffect(() => {
		console.error('Page failed', failure)
	}, [failure])
	return (
		<StatusState
			title={t('exception.serverError')}
			description={t('review.pageRecovery')}
			action={
				<>
					<Button onClick={() => location.reload()}>{t('ui.retry')}</Button>{' '}
					<Button href="/?safeMode=1#/settings/appearance">{t('review.repairAppearance')}</Button>{' '}
					<Button href="/?safeMode=1#/settings/site">{t('ui.site')}</Button>
				</>
			}
		/>
	)
}
const router = createHashRouter(
	createRoutesFromElements(
		<Route
			errorElement={<RouteError />}
			element={
				<>
					<SiteCustomization />
					<Outlet />
				</>
			}
		>
			<Route path="/" element={<Protected />} />
			<Route
				path="/login"
				element={
					<Suspense fallback={<Loading />}>
						<Login />
					</Suspense>
				}
			/>
			<Route path="/settings" element={<Navigate to="/settings/appearance" replace />} />
			<Route path="/settings/:section" element={<Protected settings />} />
			<Route path="*" element={<NotFound />} />
		</Route>,
	),
)
export default function Application() {
	return <RouterProvider router={router} />
}
