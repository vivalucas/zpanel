import { lazy, Suspense, useEffect } from 'react'
import {
	createHashRouter,
	createRoutesFromElements,
	RouterProvider,
	Outlet,
	Navigate,
	Route,
	useLocation,
} from 'react-router-dom'
import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAuth, useSite } from '@/lib/queries'
import { ApiError } from '@/lib/api'
import { usePreferences } from './store'
import { Loading, QueryError } from '@/components/shared'
import Login from '@/features/auth/Login'
const Home = lazy(() => import('@/features/home/Home'))
const Settings = lazy(() => import('@/features/settings/Settings'))

let executedCustomJs: string | undefined
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
		if (icon) icon.href = siteIcon || '/favicon.svg'
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
			if (executedCustomJs) location.reload()
			return
		}
		if (site?.customJs === undefined || executedCustomJs === site.customJs) return
		executedCustomJs = site.customJs
		if (!site.customJs) return
		const script = document.createElement('script')
		script.id = 'zpanel-custom-js'
		script.textContent = site.customJs
		document.body.append(script)
		script.remove()
	}, [safe, site?.customJs])
	return null
}
function Protected({ settings = false }: { settings?: boolean }) {
	const auth = useAuth()
	const location = useLocation()
	const { token, forgetAccount } = usePreferences()
	useEffect(() => {
		if (token && auth.data?.visitMode === 1) forgetAccount(token)
	}, [auth.data?.visitMode, token, forgetAccount])
	if (auth.isPending) return <Loading />
	if (auth.error) {
		if (auth.error instanceof ApiError && [1000, 1001, 1004].includes(auth.error.code))
			return <Navigate to="/login" replace state={{ from: location.pathname }} />
		return (
			<div className="error-page">
				<QueryError error={auth.error} retry={() => auth.refetch()} />
			</div>
		)
	}
	if (settings && auth.data.visitMode !== 0) return <Navigate to="/login" replace />
	return settings ? (
		<Suspense fallback={<Loading />}>
			<Settings auth={auth.data} />
		</Suspense>
	) : (
		<Suspense fallback={<Loading />}>
			<Home auth={auth.data} />
		</Suspense>
	)
}
function NotFound() {
	const { t } = useTranslation()
	return (
		<Result
			status="404"
			title="404"
			subTitle={t('exception.pageNotFound')}
			extra={<Button href="#/">{t('exception.goHome')}</Button>}
		/>
	)
}
const router = createHashRouter(
	createRoutesFromElements(
		<Route
			element={
				<>
					<SiteCustomization />
					<Outlet />
				</>
			}
		>
			<Route path="/" element={<Protected />} />
			<Route path="/login" element={<Login />} />
			<Route path="/settings" element={<Navigate to="/settings/appearance" replace />} />
			<Route path="/settings/:section" element={<Protected settings />} />
			<Route path="*" element={<NotFound />} />
		</Route>,
	),
)
export default function Application() {
	return <RouterProvider router={router} />
}
