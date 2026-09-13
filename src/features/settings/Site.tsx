import { useUnsavedChanges } from '@/lib/unsaved'
import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, Switch } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loading, QueryError, Section } from '@/components/shared'
export default function Site() {
	const request = useSessionRequest()
	const query = useQuery({
		queryKey: ['site-admin'],
		queryFn: ({ signal }) =>
			request<{ siteSetting: System.SiteSetting; loginCaptcha: boolean }>(
				'/system/siteSetting/get',
				{},
				{ signal },
			),
	})
	const [form] = Form.useForm()
	const [saving, setSaving] = useState(false)
	const [dirty, setDirty] = useState(false)
	useUnsavedChanges(dirty)
	const client = useQueryClient()
	const { t, error, message } = useFeedback()
	useEffect(() => {
		if (query.data && !dirty)
			form.setFieldsValue({ ...query.data.siteSetting, loginCaptcha: query.data.loginCaptcha })
	}, [query.data, form, dirty])
	if (query.isPending) return <Loading />
	if (query.error) return <QueryError error={query.error} retry={() => query.refetch()} />
	return (
		<Form
			form={form}
			onValuesChange={() => setDirty(true)}
			disabled={saving}
			layout="vertical"
			onFinish={async (values) => {
				setSaving(true)
				try {
					await request('/system/siteSetting/set', values)
					await Promise.all([
						client.invalidateQueries({ queryKey: ['site'] }),
						client.invalidateQueries({ queryKey: ['site-admin'] }),
					])
					setDirty(false)
					void message.success(t('common.success'))
				} catch (err) {
					error(err)
				} finally {
					setSaving(false)
				}
			}}
		>
			<Section title={t('apps.baseSettings.siteAndLogin')}>
				<div className="form-grid">
					{['siteTitle', 'siteIcon', 'loginTitle', 'loginSubtitle'].map((key) => (
						<Form.Item key={key} name={key} label={t(`apps.baseSettings.${key}`)}>
							<Input />
						</Form.Item>
					))}
				</div>
				<Form.Item name="loginFooter" label={t('apps.baseSettings.loginFooter')}>
					<Input.TextArea rows={3} />
				</Form.Item>
				<Form.Item name="loginCaptcha" label={t('apps.baseSettings.loginCaptcha')} valuePropName="checked">
					<Switch />
				</Form.Item>
			</Section>
			<Section title={t('apps.baseSettings.customCssJs')}>
				<Alert type="info" showIcon title={t('ui.safeModeHint')} />
				<Form.Item className="spaced" name="customCss" label="CSS">
					<Input.TextArea className="code-input" rows={7} />
				</Form.Item>
				<Form.Item name="customJs" label="JavaScript">
					<Input.TextArea className="code-input" rows={7} />
				</Form.Item>
			</Section>
			<div className="save-bar">
				<Button type="primary" htmlType="submit" loading={saving}>
					{t('common.save')}
				</Button>
			</div>
		</Form>
	)
}
