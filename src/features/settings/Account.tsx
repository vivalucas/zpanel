import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Avatar, Button, Form, Input, Select, Space, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePreferences } from '@/app/store'
import { languageOptions } from '@/locales'
import { ImageUpload, Section } from '@/components/shared'
export default function Account({ user }: { user: User.Info }) {
	const request = useSessionRequest()
	const prefs = usePreferences()
	const navigate = useNavigate()
	const client = useQueryClient()
	const { t, error, message, modal } = useFeedback()
	const [saving, setSaving] = useState(false)
	const [passwordBusy, setPasswordBusy] = useState(false)
	const [form] = Form.useForm()
	return (
		<>
			<Section title={t('ui.profile')}>
				<Form
					form={form}
					disabled={saving}
					initialValues={user}
					layout="vertical"
					onFinish={async (values) => {
						setSaving(true)
						try {
							await request('/user/updateInfo', values)
							await client.invalidateQueries({ queryKey: ['auth'] })
							if (prefs.token && usePreferences.getState().token === prefs.token)
								prefs.signIn({ token: prefs.token, user: { ...user, ...values } })
							void message.success(t('common.success'))
						} catch (err) {
							error(err)
						} finally {
							setSaving(false)
						}
					}}
				>
					<div className="form-grid">
						<Form.Item name="name" label={t('common.nikeName')} rules={[{ required: true, min: 3, max: 15 }]}>
							<Input />
						</Form.Item>
						<Form.Item name="headImage" label={t('ui.avatarUrl')}>
							<Input />
						</Form.Item>
					</div>
					<Space>
						<ImageUpload onChange={(url) => form.setFieldValue('headImage', url)} />
						<Button type="primary" htmlType="submit" loading={saving}>
							{t('common.save')}
						</Button>
					</Space>
				</Form>
			</Section>
			<Section title={t('ui.language')}>
				<Select
					aria-label={t('ui.language')}
					style={{ width: 220 }}
					value={prefs.language}
					options={languageOptions}
					onChange={(language) => prefs.setPreference({ language })}
				/>
			</Section>
			<Section title={t('ui.switchAccount')} description={t('ui.switchAccountDescription')}>
				<div className="account-list">
					{prefs.accounts.map((account) => (
						<div className="account-row" key={account.token}>
							<Avatar src={account.user.headImage}>
								{(account.user.name || account.user.username || 'Z').slice(0, 1)}
							</Avatar>
							<div className="account-copy">
								<strong>{account.user.id === user.id ? user.name : account.user.name}</strong>
								<span>{account.user.username}</span>
							</div>
							<Space>
								{account.token === prefs.token ? (
									<Tag color="blue">{t('adminSettingUsers.currentUseUsername')}</Tag>
								) : (
									<Button
										onClick={() => {
											prefs.selectAccount(account.token)
											navigate('/')
										}}
									>
										{t('ui.switch')}
									</Button>
								)}
								{account.token !== prefs.token && (
									<Button type="text" danger onClick={() => prefs.forgetAccount(account.token)}>
										{t('ui.forget')}
									</Button>
								)}
							</Space>
						</div>
					))}
				</div>
				<Button onClick={() => navigate('/login')}>{t('ui.addAccount')}</Button>
			</Section>
			<Section title={t('settingUserInfo.updatePassword')}>
				<Form
					layout="vertical"
					onFinish={async (values) => {
						setPasswordBusy(true)
						try {
							await request('/user/updatePassword', values)
							if (prefs.token) prefs.forgetAccount(prefs.token)
							navigate('/login')
							void message.success(t('ui.passwordUpdated'))
						} catch (err) {
							error(err)
						} finally {
							setPasswordBusy(false)
						}
					}}
				>
					<Form.Item name="oldPassword" label={t('settingUserInfo.oldPassword')} rules={[{ required: true }]}>
						<Input.Password autoComplete="current-password" />
					</Form.Item>
					<Form.Item
						name="newPassword"
						label={t('settingUserInfo.newPassword')}
						rules={[{ required: true, min: 6, max: 50 }]}
					>
						<Input.Password autoComplete="new-password" />
					</Form.Item>
					<Form.Item
						name="confirmPassword"
						label={t('settingUserInfo.confirmPassword')}
						dependencies={['newPassword']}
						rules={[
							{ required: true },
							({ getFieldValue }) => ({
								validator: (_, value) =>
									value === getFieldValue('newPassword')
										? Promise.resolve()
										: Promise.reject(new Error(t('settingUserInfo.confirmPasswordInconsistentMsg'))),
							}),
						]}
					>
						<Input.Password autoComplete="new-password" />
					</Form.Item>
					<Button htmlType="submit" loading={passwordBusy}>
						{t('settingUserInfo.updatePassword')}
					</Button>
				</Form>
			</Section>
			<Button
				danger
				onClick={() =>
					modal.confirm({
						title: t('settingUserInfo.confirmLogoutText'),
						onOk: async () => {
							try {
								await request('/logout')
								if (prefs.token) prefs.forgetAccount(prefs.token)
								navigate('/login')
							} catch (err) {
								error(err)
								throw err
							}
						},
					})
				}
			>
				{t('settingUserInfo.logout')}
			</Button>
		</>
	)
}
