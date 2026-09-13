import { useUnsavedChanges } from '@/lib/unsaved'
import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Select, Slider, Space, Switch } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { defaultPanel } from '@/lib/api'
import { usePanel } from '@/lib/queries'
import { usePreferences } from '@/app/store'
import { ImageUpload, Loading, QueryError, Section } from '@/components/shared'
export default function Appearance() {
	const request = useSessionRequest()
	const panel = usePanel()
	const [form] = Form.useForm<Panel.panelConfig>()
	const [saving, setSaving] = useState(false)
	const [dirty, setDirty] = useState(false)
	useUnsavedChanges(dirty)
	const client = useQueryClient()
	const { t, error, message, modal } = useFeedback()
	const prefs = usePreferences()
	useEffect(() => {
		if (panel.data && !dirty) form.setFieldsValue(panel.data.panel)
	}, [panel.data, form, dirty])
	if (panel.isPending) return <Loading />
	if (panel.error) return <QueryError error={panel.error} retry={() => panel.refetch()} />
	const toggle = (name: keyof Panel.panelConfig, label: string) => (
		<Form.Item name={name} label={t(label)} valuePropName="checked">
			<Switch />
		</Form.Item>
	)
	return (
		<Form
			form={form}
			disabled={saving}
			layout="vertical"
			onValuesChange={() => setDirty(true)}
			onFinish={async (values) => {
				setSaving(true)
				try {
					await request('/panel/userConfig/set', { ...panel.data, panel: { ...panel.data.panel, ...values } })
					await client.invalidateQueries({ queryKey: ['panel'] })
					setDirty(false)
					void message.success(t('common.success'))
				} catch (err) {
					error(err)
				} finally {
					setSaving(false)
				}
			}}
		>
			<Section title={t('ui.theme')} description={t('ui.themeDescription')}>
				<Select
					value={prefs.theme}
					style={{ width: 220 }}
					aria-label={t('ui.theme')}
					onChange={(theme) => prefs.setPreference({ theme })}
					options={['light', 'dark', 'auto'].map((value) => ({
						value,
						label: t(`apps.userInfo.themeStyle.${value}`),
					}))}
				/>
			</Section>
			<Section title={t('ui.identity')}>
				<div className="form-grid">
					<Form.Item name="logoText" label={t('ui.logoText')}>
						<Input />
					</Form.Item>
					<Form.Item name="logoImageSrc" label={t('ui.logoImage')}>
						<Input />
					</Form.Item>
				</div>
			</Section>
			<Section title={t('apps.baseSettings.wallpaper')}>
				<Form.Item name="backgroundImageSrc" label={t('ui.imageUrl')}>
					<Input allowClear />
				</Form.Item>
				<ImageUpload
					onChange={(url) => {
						form.setFieldValue('backgroundImageSrc', url)
						setDirty(true)
					}}
				/>
				<div className="form-grid spaced">
					<Form.Item name="backgroundBlur" label={t('apps.baseSettings.vague')}>
						<Slider min={0} max={30} />
					</Form.Item>
					<Form.Item name="backgroundMaskNumber" label={t('apps.baseSettings.mask')}>
						<Slider min={0} max={1} step={0.05} />
					</Form.Item>
				</div>
			</Section>
			<Section title={t('apps.baseSettings.contentArea')}>
				<div className="form-grid">
					<Form.Item name="iconStyle" label={t('ui.cardStyle')}>
						<Select
							options={[
								{ value: 0, label: t('apps.baseSettings.detailIcon') },
								{ value: 1, label: t('apps.baseSettings.smallIcon') },
							]}
						/>
					</Form.Item>
					<Form.Item name="iconTextColor" label={t('ui.textColor')}>
						<Input placeholder={t('ui.followTheme')} allowClear />
					</Form.Item>
					<Form.Item label={t('apps.baseSettings.maxWidth')}>
						<Space.Compact>
							<Form.Item name="maxWidth" noStyle rules={[{ required: true }]}>
								<InputNumber min={1} max={3000} />
							</Form.Item>
							<Form.Item name="maxWidthUnit" noStyle>
								<Select
									style={{ width: 80 }}
									options={[
										{ value: 'px', label: 'px' },
										{ value: '%', label: '%' },
									]}
								/>
							</Form.Item>
						</Space.Compact>
					</Form.Item>
					<Form.Item name="marginX" label={`${t('apps.baseSettings.leftRightMargin')} (%)`}>
						<InputNumber min={0} max={20} />
					</Form.Item>
					<Form.Item name="marginTop" label={t('apps.baseSettings.topMargin')}>
						<InputNumber min={0} max={300} />
					</Form.Item>
					<Form.Item name="marginBottom" label={t('apps.baseSettings.bottomMargin')}>
						<InputNumber min={0} max={300} />
					</Form.Item>
					{toggle('iconTextInfoHideDescription', 'apps.baseSettings.hideDescription')}
					{toggle('iconTextIconHideTitle', 'apps.baseSettings.hideTitle')}
				</div>
			</Section>
			<Section title={t('ui.widgets')}>
				<div className="form-grid">
					{toggle('clockShowSecond', 'apps.baseSettings.clockSecondShow')}
					<Form.Item name="clockColor" label={t('ui.clockColor')}>
						<Input allowClear placeholder={t('ui.followTheme')} />
					</Form.Item>
					{toggle('searchBoxShow', 'apps.baseSettings.searchBar')}
					{toggle('searchBoxSearchIcon', 'apps.baseSettings.searchBarSearchItem')}
					{toggle('systemMonitorShow', 'apps.baseSettings.systemMonitorStatus')}
					{toggle('systemMonitorShowTitle', 'apps.baseSettings.showTitle')}
					{toggle('systemMonitorPublicVisitModeShow', 'apps.baseSettings.publicVisitModeShow')}
					{toggle('netModeChangeButtonShow', 'apps.baseSettings.netModeChangeButtonShow')}
				</div>
			</Section>
			<Section title={t('apps.baseSettings.customFooter')}>
				<Form.Item name="footerHtml">
					<Input.TextArea rows={3} />
				</Form.Item>
			</Section>
			<div className="save-bar">
				{dirty && <Alert type="info" title={t('review.unsaved')} />}
				<Space>
					<Button
						onClick={() =>
							modal.confirm({
								title: t('apps.baseSettings.resetWarnText'),
								onOk: () => {
									form.setFieldsValue(defaultPanel)
									setDirty(true)
								},
							})
						}
					>
						{t('ui.resetDefaults')}
					</Button>
					<Button type="primary" htmlType="submit" loading={saving}>
						{t('common.save')}
					</Button>
				</Space>
			</div>
		</Form>
	)
}
