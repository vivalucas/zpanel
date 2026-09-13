import { LoadingOutlined } from '@ant-design/icons'
import { Component, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { App as AntApp, Button, ConfigProvider, Result, theme } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import zhCN from 'antd/locale/zh_CN'
import zhTW from 'antd/locale/zh_TW'
import enUS from 'antd/locale/en_US'
import deDE from 'antd/locale/de_DE'
import esES from 'antd/locale/es_ES'
import frFR from 'antd/locale/fr_FR'
import itIT from 'antd/locale/it_IT'
import jaJP from 'antd/locale/ja_JP'
import koKR from 'antd/locale/ko_KR'
import ptBR from 'antd/locale/pt_BR'
import ruRU from 'antd/locale/ru_RU'
import { usePreferences } from './store'
import i18n, { setLanguage } from '@/locales'
const locales = {
	'zh-CN': zhCN,
	'zh-TW': zhTW,
	'en-US': enUS,
	'de-DE': deDE,
	'es-ES': esES,
	'fr-FR': frFR,
	'it-IT': itIT,
	'ja-JP': jaJP,
	'ko-KR': koKR,
	'pt-BR': ptBR,
	'ru-RU': ruRU,
}

// A new client per session prevents previous-account data and in-flight reads from leaking.
function SessionQueries({ children }: { children: ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
					mutations: { retry: false },
				},
			}),
	)
	useEffect(
		() => () => {
			void client.cancelQueries()
			client.clear()
		},
		[client],
	)
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
function ThemeBridge({ children }: { children: ReactNode }) {
	const token = theme.useToken().token
	return (
		<div
			className="app-root"
			style={
				{
					'--surface': token.colorBgContainer,
					'--canvas': token.colorBgLayout,
					'--text': token.colorText,
					'--muted': token.colorTextSecondary,
					'--border': token.colorBorderSecondary,
					'--primary': token.colorPrimary,
					'--soft': token.colorFillQuaternary,
					'--radius': `${token.borderRadiusLG}px`,
				} as React.CSSProperties
			}
		>
			{children}
		</div>
	)
}
export function Providers({ children }: { children: ReactNode }) {
	const { theme: preference, language, token } = usePreferences()
	const [osDark, setOsDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
	useEffect(() => {
		const media = matchMedia('(prefers-color-scheme: dark)')
		const listener = () => setOsDark(media.matches)
		media.addEventListener('change', listener)
		return () => media.removeEventListener('change', listener)
	}, [])
	useEffect(() => {
		void setLanguage(language).catch(() => {
			void i18n.changeLanguage('en-US')
		})
		document.documentElement.lang = language
	}, [language])
	const dark = preference === 'dark' || (preference === 'auto' && osDark)
	useEffect(() => {
		document.documentElement.dataset.theme = dark ? 'dark' : 'light'
		document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
	}, [dark])
	return (
		<ConfigProvider
			button={{ autoInsertSpace: false, loadingIcon: <LoadingOutlined spin aria-hidden="true" /> }}
			locale={locales[language as keyof typeof locales] || enUS}
			theme={{
				algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
				token: {
					colorPrimary: '#5266eb',
					borderRadius: 10,
					controlHeight: 38,
					fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
				},
				components: {
					Modal: { borderRadiusLG: 18 },
					Card: { borderRadiusLG: 16 },
					Button: { fontWeight: 500 },
				},
			}}
		>
			<AntApp>
				<ThemeBridge>
					<SessionQueries key={token || 'guest'}>{children}</SessionQueries>
				</ThemeBridge>
			</AntApp>
		</ConfigProvider>
	)
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(error, info.componentStack)
	}
	render() {
		return this.state.failed ? (
			<Result
				status="500"
				title="ZPanel"
				subTitle={i18n.t('exception.serverError')}
				extra={<Button onClick={() => location.reload()}>{i18n.t('ui.retry')}</Button>}
			/>
		) : (
			this.props.children
		)
	}
}
