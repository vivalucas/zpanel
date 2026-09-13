import { useSessionRequest } from '@/lib/session'
import { randomId } from '@/lib/id'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Button, Form, Input, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSite } from '@/lib/queries'
import { apiBase } from '@/lib/api'
import { usePreferences } from '@/app/store'
import { Loading, QueryError, SafeHtml } from '@/components/shared'
export default function Login() {
	const request = useSessionRequest()
	const site = useSite()
	const navigate = useNavigate()
	const location = useLocation()
	const { t, error } = useFeedback()
	const [busy, setBusy] = useState(false)
	const [captchaId, setCaptchaId] = useState(() => randomId())
	const signIn = usePreferences((s) => s.signIn)
	if (site.isPending) return <Loading />
	if (site.error)
		return (
			<div className="error-page">
				<QueryError error={site.error} retry={() => site.refetch()} />
			</div>
		)
	const settings = site.data.siteSetting
	return (
		<main className="login-page">
			<div className="login-art">
				<div className="brand-mark">Z</div>
				<h1>{settings.loginTitle || 'ZPanel'}</h1>
				<>{settings.loginSubtitle && <p>{settings.loginSubtitle}</p>}</>
				<div className="login-orbit" />
			</div>
			<div className="login-content">
				<Button
					className="login-back"
					type="text"
					icon={<ArrowLeftOutlined aria-hidden="true" />}
					onClick={() => navigate('/')}
				>
					{t('exception.goHome')}
				</Button>
				<div className="login-form">
					<div className="brand-mark small">Z</div>
					<Typography.Title level={2}>{t('login.welcomeMessage')}</Typography.Title>
					<Form
						layout="vertical"
						requiredMark={false}
						onFinish={async (values: { username: string; password: string; vcode?: string }) => {
							setBusy(true)
							try {
								const user = await request<User.Info & { token: string }>(
									'/login',
									{ ...values, email: captchaId },
									{ token: null },
								)
								signIn({ token: user.token, user })
								navigate(location.state?.from?.startsWith('/settings') ? location.state.from : '/', {
									replace: true,
								})
							} catch (err) {
								error(err)
								setCaptchaId(randomId())
							} finally {
								setBusy(false)
							}
						}}
					>
						<Form.Item name="username" label={t('common.username')} rules={[{ required: true }]}>
							<Input prefix={<UserOutlined aria-hidden="true" />} autoComplete="username" size="large" />
						</Form.Item>
						<Form.Item name="password" label={t('login.passwordPlaceholder')} rules={[{ required: true }]}>
							<Input.Password
								prefix={<LockOutlined aria-hidden="true" />}
								autoComplete="current-password"
								size="large"
								maxLength={50}
							/>
						</Form.Item>
						{site.data.loginCaptcha && (
							<Form.Item label={t('verification.title')}>
								<div className="captcha-row">
									<Form.Item name="vcode" noStyle rules={[{ required: true }]}>
										<Input autoComplete="off" maxLength={6} />
									</Form.Item>
									<button
										type="button"
										className="captcha"
										aria-label={t('ui.refreshCaptcha')}
										onClick={() => setCaptchaId(randomId())}
									>
										<img
											alt={t('verification.title')}
											src={`${apiBase}/captcha/getImageByCaptchaId/${captchaId}/120/40`}
										/>
									</button>
								</div>
							</Form.Item>
						)}
						<Button type="primary" htmlType="submit" size="large" block loading={busy}>
							{t('login.loginButton')}
						</Button>
					</Form>
					<SafeHtml className="login-footer" html={settings.loginFooter} />
				</div>
			</div>
		</main>
	)
}
