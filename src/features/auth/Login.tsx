import { useSessionRequest } from '@/lib/session'
import { randomId } from '@/lib/id'
import { useFeedback } from '@/lib/feedback'
import { useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Button, Form, Input, Select, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSite } from '@/lib/queries'
import { apiBase } from '@/lib/api'
import { passwordRule } from '@/lib/password'
import { usePreferences } from '@/app/store'
import { languageOptions } from '@/locales'
import { Loading, QueryError } from '@/components/shared'
import { SafeHtml } from '@/components/SafeHtml'
import { BrandMark } from '@/components/BrandMark'

function CaptchaInput({
	image,
	refreshLabel,
	imageLabel,
	onRefresh,
	...input
}: ComponentProps<typeof Input> & {
	image: string
	refreshLabel: string
	imageLabel: string
	onRefresh: () => void
}) {
	return (
		<div className="captcha-row">
			<Input {...input} />
			<button
				type="button"
				className="captcha"
				disabled={input.disabled}
				aria-label={refreshLabel}
				onClick={onRefresh}
			>
				<img alt={imageLabel} src={image} />
			</button>
		</div>
	)
}

export default function Login() {
	const request = useSessionRequest()
	const site = useSite()
	const navigate = useNavigate()
	const location = useLocation()
	const { t, error } = useFeedback()
	const [busy, setBusy] = useState(false)
	const submittingRef = useRef(false)
	const [captchaId, setCaptchaId] = useState(() => randomId())
	const { language, setPreference, signIn } = usePreferences()
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
				<BrandMark />
				<h1>{settings.loginTitle || 'ZPanel'}</h1>
				<>{settings.loginSubtitle && <p>{settings.loginSubtitle}</p>}</>
				<div className="login-orbit" />
			</div>
			<div className="login-content">
				<div className="login-toolbar">
					{location.state?.fromPublicHome && (
						<Button
							className="login-back"
							type="text"
							icon={<ArrowLeftOutlined aria-hidden="true" />}
							onClick={() => navigate('/')}
						>
							{t('exception.goHome')}
						</Button>
					)}
					<Select
						className="login-language"
						aria-label={t('ui.language')}
						value={language}
						options={languageOptions}
						onChange={(value) => setPreference({ language: value })}
					/>
				</div>
				<div className="login-form">
					<BrandMark small />
					<Typography.Title level={2}>{t('login.welcomeMessage')}</Typography.Title>
					<Form
						disabled={busy}
						layout="vertical"
						requiredMark={false}
						onFinish={async (values: { username: string; password: string; vcode?: string }) => {
							if (submittingRef.current) return
							submittingRef.current = true
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
								submittingRef.current = false
								setBusy(false)
							}
						}}
					>
						<Form.Item name="username" label={t('common.username')} rules={[{ required: true }]}>
							<Input prefix={<UserOutlined aria-hidden="true" />} autoComplete="username" size="large" />
						</Form.Item>
						<Form.Item
							name="password"
							label={t('login.passwordPlaceholder')}
							rules={[{ required: true }, passwordRule(t('review.passwordMax'), false)]}
						>
							<Input.Password
								prefix={<LockOutlined aria-hidden="true" />}
								autoComplete="current-password"
								size="large"
								maxLength={72}
							/>
						</Form.Item>
						{site.data.loginCaptcha && (
							<Form.Item
								name="vcode"
								label={t('verification.title')}
								rules={[{ required: true, message: t('verification.required') }]}
							>
								<CaptchaInput
									autoComplete="off"
									maxLength={6}
									disabled={busy}
									image={`${apiBase}/captcha/getImageByCaptchaId/${captchaId}/120/40`}
									imageLabel={t('verification.title')}
									refreshLabel={t('ui.refreshCaptcha')}
									onRefresh={() => setCaptchaId(randomId())}
								/>
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
