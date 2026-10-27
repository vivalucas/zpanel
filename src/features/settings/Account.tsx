import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useRef, useState } from 'react'
import { Avatar, Button, Form, Input, Select, Space, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { usePreferences } from '@/app/store'
import { languageOptions } from '@/locales'
import { Section } from '@/components/shared'
import { ImageUpload } from '@/components/ImageUpload'
import { passwordRule } from '@/lib/password'
import { useUnsavedChanges } from '@/lib/unsaved'
import { useAutoSave } from '@/lib/autoSave'
import { AutoSaveStatus } from '@/components/AutoSaveStatus'
import type { AuthInfo } from '@/lib/api'
export default function Account({ user }: { user: User.Info }) {
	const request = useSessionRequest()
	const prefs = usePreferences()
	const navigate = useNavigate()
	const client = useQueryClient()
	const { t, error, message, modal } = useFeedback()
	const [passwordBusy, setPasswordBusy] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [form] = Form.useForm()
	const [passwordDirty, setPasswordDirty] = useState(false)
	const avatarRevisionRef = useRef(0)
	const savedNicknameRef = useRef(user.name)
	const profileSave = useAutoSave({
		form,
		paused: uploading,
		save: async (values) => {
			await client.cancelQueries({ queryKey: ['auth'] })
			await request('/user/updateInfo', values)
			void client.cancelQueries({ queryKey: ['auth'] })
			savedNicknameRef.current = values.name
			client.setQueryData<AuthInfo>(['auth'], (previous) =>
				previous ? { ...previous, user: { ...previous.user, ...values } } : previous,
			)
			if (prefs.token && usePreferences.getState().token === prefs.token)
				prefs.signIn({ token: prefs.token, user: { ...user, ...values } })
		},
	})
	const allowNavigation = useUnsavedChanges(
		profileSave.dirty || passwordDirty || uploading,
		!passwordDirty && !uploading && ['pending', 'saving'].includes(profileSave.status),
	)
	const switchAccount = (token: string) => {
		const proceed = () => {
			allowNavigation()
			setPasswordDirty(false)
			prefs.selectAccount(token)
			navigate('/')
		}
		if (profileSave.dirty || passwordDirty || uploading)
			modal.confirm({ title: t('ui.leaveUnsaved'), content: t('review.unsaved'), onOk: proceed })
		else proceed()
	}
	return (
		<>
			<Section title={t('ui.profile')}>
				<Form
					form={form}
					initialValues={user}
					layout="vertical"
					onValuesChange={(changed) => {
						if ('headImage' in changed) avatarRevisionRef.current++
						profileSave.changed()
					}}
				>
					<div className="form-grid">
						<Form.Item
							name="name"
							label={t('common.nikeName')}
							rules={[
								{ required: true },
								// Existing nicknames remain valid until the user edits them.
								({ getFieldValue }) =>
									getFieldValue('name') === savedNicknameRef.current ? {} : { min: 3, max: 15 },
							]}
						>
							<Input />
						</Form.Item>
						<Form.Item name="headImage" label={t('ui.avatarUrl')}>
							<Input />
						</Form.Item>
					</div>
					<div className="form-actions">
						<ImageUpload
							disabled={profileSave.saving}
							onUploadingChange={setUploading}
							onStart={() => {
								const revision = avatarRevisionRef.current
								return (url) => {
									if (avatarRevisionRef.current !== revision) return
									avatarRevisionRef.current++
									form.setFieldValue('headImage', url)
									profileSave.changed()
								}
							}}
						/>
						<AutoSaveStatus state={profileSave} />
					</div>
				</Form>
			</Section>
			<Section title={t('ui.language')} description={t('ui.languageDescription')}>
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
							<Avatar src={account.user.headImage || undefined}>
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
									<Button onClick={() => switchAccount(account.token)}>{t('ui.switch')}</Button>
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
			<Section title={t('settingUserInfo.updatePassword')} description={t('ui.passwordDescription')}>
				<Form
					layout="vertical"
					onValuesChange={() => setPasswordDirty(true)}
					disabled={passwordBusy}
					onFinish={async (values) => {
						if (passwordBusy) return
						setPasswordBusy(true)
						try {
							await request('/user/updatePassword', values)
							allowNavigation()
							setPasswordDirty(false)
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
						rules={[{ required: true }, passwordRule(t('review.passwordSize'))]}
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
					<div className="form-actions">
						{passwordDirty && (
							<span className="settings-draft-hint" role="status">
								{t('ui.unsavedChanges')}
							</span>
						)}
						<Button type="primary" htmlType="submit" loading={passwordBusy}>
							{t('settingUserInfo.updatePassword')}
						</Button>
					</div>
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
								allowNavigation()
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
