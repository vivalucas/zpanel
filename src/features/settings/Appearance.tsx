import { useUnsavedChanges } from '@/lib/unsaved'
import { useAutoSave } from '@/lib/autoSave'
import { AutoSaveStatus } from '@/components/AutoSaveStatus'
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
import WallpaperPreview from './WallpaperPreview'
import HomeTextColor from './HomeTextColor'
export default function Appearance() {
	const request = useSessionRequest()
	const panel = usePanel()
	const [form] = Form.useForm<Panel.panelConfig>()
	const [uploading, setUploading] = useState(false)
	const [adjusting, setAdjusting] = useState(false)
	const wallpaper = Form.useWatch('backgroundImageSrc', form)
	const wallpaperBlur = Form.useWatch('backgroundBlur', form) || 0
	const wallpaperShade = Form.useWatch('backgroundMaskNumber', form) || 0
	const wallpaperAutoContrast = Form.useWatch('wallpaperAutoContrast', form) === true
	const wallpaperRevisionRef = useRef(0)
	const logoText = Form.useWatch('logoText', form)
	const logoImage = Form.useWatch('logoImageSrc', form)
	const iconTextColor = Form.useWatch('iconTextColor', form)
	const client = useQueryClient()
	const { t, modal } = useFeedback()
	const autoSave = useAutoSave({
		form,
		paused: uploading || adjusting,
		enabled: !!panel.data && !isAccessError(panel.error),
		save: async (values) => {
			const config = { ...panel.data!, panel: { ...panel.data!.panel, ...values } }
			await client.cancelQueries({ queryKey: ['panel'] })
			await request('/panel/userConfig/set', config)
			void client.cancelQueries({ queryKey: ['panel'] })
			client.setQueryData(['panel'], { ...config, panelWarnings: [] })
		},
	})
	const { dirty, saving } = autoSave
	useUnsavedChanges(
		dirty || uploading,
		!uploading && !isAccessError(panel.error) && ['pending', 'saving'].includes(autoSave.status),
	)
	const prefs = usePreferences()
	useEffect(() => {
		if (!adjusting) return
		const finish = () => setAdjusting(false)
		window.addEventListener('pointerup', finish)
		window.addEventListener('pointercancel', finish)
		return () => {
			window.removeEventListener('pointerup', finish)
			window.removeEventListener('pointercancel', finish)
		}
	}, [adjusting])
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
			layout="vertical"
			onValuesChange={(changed) => {
				if ('backgroundImageSrc' in changed) wallpaperRevisionRef.current++
				autoSave.changed()
			}}
			onFinish={autoSave.retry}
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
					<Alert
						className="spaced"
						type="warning"
						showIcon
						title={t('review.panelRepairSave')}
						action={
							<Button disabled={saving || uploading} onClick={autoSave.changed}>
								{t('review.repairAppearance')}
							</Button>
						}
					/>
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
					<WallpaperPreview
						src={wallpaper}
						shade={wallpaperShade}
						blur={wallpaperBlur}
						autoContrast={wallpaperAutoContrast}
						title={logoText}
						textColor={iconTextColor}
					/>
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
								autoSave.changed()
							}
						}}
					/>
					<div
						className="form-grid spaced"
						onPointerDownCapture={(event) => {
							if ((event.target as HTMLElement).closest('.ant-slider')) setAdjusting(true)
						}}
						onPointerCancel={() => setAdjusting(false)}
					>
						<Form.Item
							name="backgroundBlur"
							label={t('ui.wallpaperBlur')}
							getValueProps={(value) => ({ value: (value || 0) / 3 })}
							normalize={(value) => value * 3}
						>
							<Slider
								min={0}
								max={10}
								step={1}
								marks={{ 0: '0', 10: '10' }}
								tooltip={{ formatter: (value) => `${value} / 10` }}
								ariaLabelForHandle={t('ui.wallpaperBlur')}
								onChangeComplete={() => setAdjusting(false)}
							/>
						</Form.Item>
						<Form.Item
							name="backgroundMaskNumber"
							label={t('ui.wallpaperShade')}
							getValueProps={(value) => ({ value: (value || 0) * 10 })}
							normalize={(value) => value / 10}
						>
							<Slider
								min={0}
								max={10}
								step={1}
								marks={{ 0: '0', 10: '10' }}
								tooltip={{ formatter: (value) => `${value} / 10` }}
								ariaLabelForHandle={t('ui.wallpaperShade')}
								onChangeComplete={() => setAdjusting(false)}
							/>
						</Form.Item>
					</div>
					<Form.Item
						className="setting-toggle"
						layout="horizontal"
						labelCol={{ xs: { span: 18 } }}
						wrapperCol={{ xs: { span: 6 } }}
						name="wallpaperAutoContrast"
						label={t('ui.wallpaperAutoContrast')}
						valuePropName="checked"
					>
						<Switch aria-describedby="wallpaper-auto-contrast-help" />
					</Form.Item>
					<p className="wallpaper-preview-note" id="wallpaper-auto-contrast-help">
						{t('ui.wallpaperAutoContrastHelp')}
					</p>
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
						<Form.Item
							name="iconTextColor"
							label={t('ui.textColor')}
							extra={t('ui.textColorHelp')}
							rules={[
								{ max: 100 },
								{
									validator: (_, value) =>
										!value || CSS.supports('color', value)
											? Promise.resolve()
											: Promise.reject(new Error(t('ui.invalidTextColor'))),
								},
							]}
						>
							<HomeTextColor />
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
				<AutoSaveStatus state={autoSave} />
				<Space>
					<Button
						disabled={saving || uploading}
						onClick={() =>
							modal.confirm({
								title: t('ui.resetDefaultsConfirm'),
								onOk: () => {
									wallpaperRevisionRef.current++
									form.setFieldsValue(defaultPanel)
									autoSave.changed()
								},
							})
						}
					>
						{t('ui.resetDefaults')}
					</Button>
				</Space>
			</div>
		</Form>
	)
}
