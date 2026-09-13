import { lazy, Suspense } from 'react'
import { Button, Menu, Result, Select } from 'antd'
import {
	ArrowLeftOutlined,
	AppstoreOutlined,
	CloudUploadOutlined,
	DatabaseOutlined,
	DesktopOutlined,
	GlobalOutlined,
	InfoCircleOutlined,
	SearchOutlined,
	TeamOutlined,
	UserOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import type { AuthInfo } from '@/lib/api'
import { Loading } from '@/components/shared'
import { useTranslation } from 'react-i18next'
const Appearance = lazy(() => import('./Appearance'))
const Groups = lazy(() => import('./Groups'))
const Files = lazy(() => import('./Files'))
const Account = lazy(() => import('./Account'))
const Users = lazy(() => import('./Users'))
const Docker = lazy(() => import('./Docker'))
const Backup = lazy(() => import('./Backup'))
const Site = lazy(() => import('./Site'))
const Modules = lazy(() => import('./Modules'))
const About = lazy(() => import('./About'))
export default function Settings({ auth }: { auth: AuthInfo }) {
	const { section = 'appearance' } = useParams()
	const navigate = useNavigate()
	const { t } = useTranslation()
	const sections = [
		{
			key: 'appearance',
			label: t('apps.baseSettings.appName'),
			icon: <DesktopOutlined aria-hidden="true" />,
		},
		{ key: 'groups', label: t('ui.groups'), icon: <AppstoreOutlined aria-hidden="true" /> },
		{ key: 'modules', label: t('ui.widgets'), icon: <SearchOutlined aria-hidden="true" /> },
		{ key: 'files', label: t('ui.files'), icon: <CloudUploadOutlined aria-hidden="true" /> },
		{ key: 'backup', label: t('ui.backup'), icon: <DatabaseOutlined aria-hidden="true" /> },
		{ key: 'account', label: t('ui.account'), icon: <UserOutlined aria-hidden="true" /> },
		...(auth.user.role === 1
			? [
					{ key: 'users', label: t('adminSettingUsers.appName'), icon: <TeamOutlined aria-hidden="true" /> },
					{ key: 'docker', label: 'Docker', icon: <AppstoreOutlined aria-hidden="true" /> },
					{ key: 'site', label: t('ui.site'), icon: <GlobalOutlined aria-hidden="true" /> },
				]
			: []),
		{ key: 'about', label: t('apps.about.appName'), icon: <InfoCircleOutlined aria-hidden="true" /> },
	]
	const allowed = sections.some((item) => item.key === section)
	return (
		<div className="settings-page">
			<aside className="settings-sidebar">
				<a className="brand" href="#/">
					<span className="brand-mark small">Z</span>
					<strong>ZPanel</strong>
				</a>
				<div className="sidebar-label">{t('ui.settings')}</div>
				<Menu selectedKeys={[section]} items={sections} onClick={({ key }) => navigate(`/settings/${key}`)} />
				<Button
					className="back-home"
					type="text"
					icon={<ArrowLeftOutlined aria-hidden="true" />}
					onClick={() => navigate('/')}
				>
					{t('exception.goHome')}
				</Button>
			</aside>
			<main className="settings-main">
				<header className="settings-header">
					<div>
						<h1>{sections.find((s) => s.key === section)?.label || t('exception.pageNotFound')}</h1>
					</div>
					<Button icon={<ArrowLeftOutlined aria-hidden="true" />} onClick={() => navigate('/')}>
						{t('exception.goHome')}
					</Button>
				</header>
				<Select
					className="mobile-settings-nav"
					value={section}
					options={sections.map((s) => ({ value: s.key, label: s.label }))}
					onChange={(value) => navigate(`/settings/${value}`)}
					aria-label={t('ui.settings')}
				/>
				<div className="settings-body">
					<Suspense fallback={<Loading />}>
						{!allowed ? (
							<Result
								status={['users', 'docker', 'site'].includes(section) ? '403' : '404'}
								title={['users', 'docker', 'site'].includes(section) ? '403' : '404'}
							/>
						) : (
							<div key={section}>
								{section === 'appearance' && <Appearance />}
								{section === 'groups' && <Groups />}
								{section === 'modules' && <Modules />}
								{section === 'files' && <Files user={auth.user} />}
								{section === 'backup' && <Backup />}
								{section === 'account' && <Account user={auth.user} />}
								{section === 'users' && <Users currentUser={auth.user} />}
								{section === 'docker' && <Docker />}
								{section === 'site' && <Site />}
								{section === 'about' && <About />}
							</div>
						)}
					</Suspense>
				</div>
			</main>
		</div>
	)
}
