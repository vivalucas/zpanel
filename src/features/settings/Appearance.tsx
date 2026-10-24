import { useUnsavedChanges } from '@/lib/unsaved'
import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useRef, useState } from 'react'
import {
	Alert,
	Button,
	Form,
	Input,
	InputNumber,
	Select,
	Slider,
	Space,
	Switch,
	Segmented,
	Avatar,
} from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { defaultPanel } from '@/lib/api'
import { usePanel } from '@/lib/queries'
import { isAccessError } from '@/lib/queryState'
import { usePreferences } from '@/app/store'
import { Loading, QueryError, Section } from '@/components/shared'
import { ImageUpload } from '@/components/ImageUpload'
export default function Appearance() {
	const request = useSessionRequest()
	const panel = usePanel()
	const [form] = Form.useForm<Panel.panelConfig>()
	const [saving, setSaving] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [dirty, setDirty] = useState(false)
	const wallpaper = Form.useWatch('backgroundImageSrc', form)
	const wallpaperBlur = Form.useWatch('backgroundBlur', form) || 0
	const wallpaperShade = Form.useWatch('backgroundMaskNumber', form) || 0
	const wallpaperRevisionRef = useRef(0)
	const logoText = Form.useWatch('logoText', form)
	const logoImage = Form.useWatch('logoImageSrc', form)
	useUnsavedChanges(dirty)
	const client = useQueryClient()
	const { t, error, message, modal } = useFeedback()
	const prefs = usePreferences()
	useEffect(() => {
		if (panel.data && !dirty) form.setFieldsValue(panel.data.panel)
	}, [panel.data, form, dirty])
	if (panel.isPending) return <Loading />
	if (panel.error && (!panel.data || isAccessError(panel.error)))
		return <QueryError error={panel.error} retry={() => panel.refetch()} />
	const toggle = (name: keyof Panel.panelConfig, label: string) => (
		<Form.Item
			className="setting-toggle"
			layout="horizontal"
			labelCol={{ xs: { span: 18 } }}
			wrapperCol={{ xs: { span: 6 } }}
			name={name}
			label={t(label)}
			valuePropName="checked"
		>
			<Switch />
		</Form.Item>
	)
	return (
		<Form
			className="settings-form"
			form={form}
			disabled={saving}
			layout="vertical"
			onValuesChange={(changed) => {
				if ('backgroundImageSrc' in changed) wallpaperRevisionRef.current++
				setDirty(true)
			}}
			onFinish={async (values) => {
				if (saving || uploading) return
				setSaving(true)
				try {
					await request('/panel/userConfig/set', { ...panel.data, panel: { ...panel.data.panel, ...values } })
					client.setQueryData(['panel'], {
						...panel.data,
						panel: { ...panel.data.panel, ...values },
						panelWarnings: [],
					})
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
			<div className="settings-form-content">
				{panel.error && (
					<QueryError
						compact
						error={panel.error}
						title={t('ui.refreshFailedWithPreviousData')}
						retry={() => panel.refetch()}
					/>
				)}
				{!!panel.data.panelWarnings.length && (
					<Alert className="spaced" type="warning" showIcon title={t('review.panelRepairSave')} />
				)}
				<Section title={t('ui.theme')} description={t('ui.themeDescription')}>
					<Segmented
						className="theme-picker"
						block
						styles={{ item: { minWidth: 0 }, label: { paddingInline: 4, whiteSpace: 'normal' } }}
						value={prefs.theme}
						aria-label={t('ui.theme')}
						onChange={(theme) => prefs.setPreference({ theme: theme as 'light' | 'dark' | 'auto' })}
						options={(['light', 'dark', 'auto'] as const).map((value) => ({
							value,
							label: (
								<span className="theme-option">
									<span className={`theme-swatch theme-swatch-${value}`} aria-hidden="true">
										<i />
										<i />
										<i />
									</span>
									{t(`apps.userInfo.themeStyle.${value}`)}
								</span>
							),
						}))}
					/>
				</Section>
				<Section title={t('ui.identity')} description={t('ui.identityDescription')}>
					<div className="identity-preview" aria-hidden="true">
						<Avatar className="identity-mark" shape="square" size={36} src={logoImage || undefined}>
							{Array.from(logoText || 'Z')[0]}
						</Avatar>
						<strong title={logoText || 'ZPanel'}>{logoText || 'ZPanel'}</strong>
					</div>
					<div className="form-grid">
						<Form.Item name="logoText" label={t('ui.logoText')} rules={[{ max: 200 }]}>
							<Input />
						</Form.Item>
						<Form.Item name="logoImageSrc" label={t('ui.logoImage')}>
							<Input />
						</Form.Item>
					</div>
				</Section>
				<Section title={t('apps.baseSettings.wallpaper')} description={t('ui.wallpaperDescription')}>
					<div className="wallpaper-preview" aria-hidden="true">
						<div
							className="wallpaper-preview-image"
							style={{
								...(wallpaper ? { backgroundImage: `url(${JSON.stringify(wallpaper)})` } : {}),
								filter: `blur(${wallpaperBlur}px)`,
							}}
						/>
						<div
							className="wallpaper-preview-shade"
							style={{ backgroundColor: `rgba(0, 0, 0, ${wallpaperShade})` }}
						/>
						<div className="wallpaper-preview-icons">
							<span />
							<span />
							<span />
						</div>
					</div>
					<Form.Item name="backgroundImageSrc" label={t('ui.imageUrl')}>
						<Input allowClear />
					</Form.Item>
					<ImageUpload
						disabled={saving}
						onUploadingChange={setUploading}
						onStart={() => {
							const revision = wallpaperRevisionRef.current
							return (url) => {
								if (revision !== wallpaperRevisionRef.current) return
								wallpaperRevisionRef.current++
								form.setFieldValue('backgroundImageSrc', url)
								setDirty(true)
							}
						}}
					/>
					<div className="form-grid spaced">
						<Form.Item name="backgroundBlur" label={t('ui.wallpaperBlur')}>
							<Slider min={0} max={30} ariaLabelForHandle={t('ui.wallpaperBlur')} />
						</Form.Item>
						<Form.Item name="backgroundMaskNumber" label={t('ui.wallpaperShade')}>
							<Slider min={0} max={1} step={0.05} ariaLabelForHandle={t('ui.wallpaperShade')} />
						</Form.Item>
					</div>
				</Section>
				<Section title={t('apps.baseSettings.contentArea')} description={t('ui.contentAreaDescription')}>
					<div className="form-grid">
						<Form.Item name="iconStyle" label={t('ui.cardStyle')}>
							<Select
								options={[
									{ value: 2, label: t('apps.baseSettings.detailIcon') },
									{ value: 1, label: t('apps.baseSettings.smallIcon') },
								]}
							/>
						</Form.Item>
						<Form.Item name="iconTextColor" label={t('ui.textColor')}>
							<Input placeholder={t('ui.followTheme')} allowClear />
						</Form.Item>
						<Form.Item label={t('apps.baseSettings.maxWidth')} htmlFor="maxWidth">
							<Space.Compact>
								<Form.Item name="maxWidth" noStyle rules={[{ required: true }]}>
									<InputNumber min={1} max={3000} aria-label={t('apps.baseSettings.maxWidth')} />
								</Form.Item>
								<Form.Item name="maxWidthUnit" noStyle>
									<Select
										aria-label={t('ui.widthUnit')}
										style={{ width: 80 }}
										options={[
											{ value: 'px', label: 'px' },
											{ value: '%', label: '%' },
										]}
									/>
								</Form.Item>
							</Space.Compact>
						</Form.Item>
						<Form.Item
							name="marginX"
							rules={[{ required: true }]}
							label={`${t('apps.baseSettings.leftRightMargin')} (px)`}
						>
							<InputNumber min={0} max={100} />
						</Form.Item>
						<Form.Item
							name="marginTop"
							rules={[{ required: true }]}
							label={`${t('apps.baseSettings.topMargin')} (%)`}
							extra={t('ui.topMarginDescription')}
						>
							<InputNumber min={0} max={50} />
						</Form.Item>
						<Form.Item
							name="marginBottom"
							rules={[{ required: true }]}
							label={`${t('apps.baseSettings.bottomMargin')} (%)`}
						>
							<InputNumber min={0} max={50} />
						</Form.Item>
						{toggle('iconTextInfoHideDescription', 'ui.hideDetailDescription')}
						{toggle('iconTextIconHideTitle', 'ui.hideCompactTitle')}
					</div>
				</Section>
				<Section title={t('ui.widgets')} description={t('ui.widgetsDescription')}>
					<div className="form-grid">
						{toggle('clockShowSecond', 'apps.baseSettings.clockSecondShow')}
						<Form.Item name="clockColor" label={t('ui.clockColor')}>
							<Input allowClear placeholder={t('ui.followTheme')} />
						</Form.Item>
						{toggle('searchBoxShow', 'apps.baseSettings.searchBar')}
						{toggle('searchBoxSearchIcon', 'apps.baseSettings.searchBarSearchItem')}
						{toggle('systemMonitorShow', 'apps.baseSettings.systemMonitorStatus')}
						{toggle('systemMonitorShowTitle', 'ui.showMonitorTitle')}
						{toggle('systemMonitorPublicVisitModeShow', 'ui.publicMonitor')}
						{toggle('netModeChangeButtonShow', 'apps.baseSettings.netModeChangeButtonShow')}
					</div>
				</Section>
				<Section title={t('apps.baseSettings.customFooter')} description={t('ui.footerDescription')}>
					<Form.Item name="footerHtml">
						<Input.TextArea rows={3} aria-label={t('apps.baseSettings.customFooter')} />
					</Form.Item>
				</Section>
			</div>
			<div className="save-bar">
				{dirty && (
					<span className="settings-draft-hint" role="status">
						{t('ui.unsavedChanges')}
					</span>
				)}
				<Space>
					<Button
						disabled={saving || uploading}
						onClick={() =>
							modal.confirm({
								title: t('ui.resetDefaultsConfirm'),
								onOk: () => {
									wallpaperRevisionRef.current++
									form.setFieldsValue(defaultPanel)
									setDirty(true)
								},
							})
						}
					>
						{t('ui.resetDefaults')}
					</Button>
					<Button type="primary" htmlType="submit" loading={saving} disabled={uploading}>
						{t('common.save')}
					</Button>
				</Space>
			</div>
		</Form>
	)
}
