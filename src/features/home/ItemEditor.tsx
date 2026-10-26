import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useRef, useState } from 'react'
import { Button, ConfigProvider, Form, Input, Modal, Select, Space } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import type { Group } from '@/lib/api'
import { ImageUpload } from '@/components/ImageUpload'
import { isSafeNavigationUrl } from '@/utils/navigation'
import { useUnsavedChanges } from '@/lib/unsaved'

export default function ItemEditor({
	item,
	groupId,
	groups,
	onClose,
}: {
	item?: Panel.ItemInfo
	groupId?: number
	groups: Group[]
	onClose: () => void
}) {
	const request = useSessionRequest()
	const [form] = Form.useForm<Panel.ItemInfo>()
	const [busy, setBusy] = useState(false)
	const [faviconBusy, setFaviconBusy] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [dirty, setDirty] = useState(false)
	const iconDraftVersionRef = useRef(0)
	const discardOpenRef = useRef(false)
	const { t, error, message, modal } = useFeedback()
	const client = useQueryClient()
	const type = Form.useWatch(['icon', 'itemType'], form)
	useUnsavedChanges(dirty || uploading || faviconBusy)
	const requestClose = () => {
		if (busy || discardOpenRef.current) return
		if (!dirty && !uploading && !faviconBusy) return onClose()
		discardOpenRef.current = true
		modal.confirm({
			title: t('ui.leaveUnsaved'),
			content: t('review.unsaved'),
			onOk: onClose,
			afterClose: () => {
				discardOpenRef.current = false
			},
		})
	}

	const urlRule = {
		validator: (_: unknown, value: string) =>
			!value || isSafeNavigationUrl(value)
				? Promise.resolve()
				: Promise.reject(new Error(t('review.invalidUrl'))),
	}
	// Keep modal geometry stable before scrolled fields open their Select popups.
	return (
		<Modal
			open
			width={820}
			transitionName=""
			className="item-editor-modal"
			classNames={{
				container: 'item-editor-container',
				header: 'item-editor-header',
				body: 'item-editor-body',
				footer: 'item-editor-footer',
			}}
			title={t(item ? 'iconItem.edit' : 'iconItem.add')}
			onCancel={requestClose}
			cancelButtonProps={{ disabled: busy }}
			confirmLoading={busy}
			okButtonProps={{ disabled: uploading || faviconBusy }}
			onOk={() => form.submit()}
			destroyOnHidden
		>
			<ConfigProvider
				theme={{
					components: { Form: { itemMarginBottom: 12, verticalLabelPadding: '0 0 6px' } },
				}}
			>
				<Form
					className="item-editor-form"
					form={form}
					disabled={busy}
					initialValues={
						item || {
							title: '',
							url: '',
							lanUrl: '',
							description: '',
							openMethod: 2,
							itemIconGroupId: groupId || groups[0]?.id,
							icon: { itemType: 1, text: '', backgroundColor: '#eef0ff' },
						}
					}
					layout="vertical"
					requiredMark={false}
					onValuesChange={(changed) => {
						setDirty(true)
						if (changed.icon && ('src' in changed.icon || 'itemType' in changed.icon))
							iconDraftVersionRef.current++
					}}
					onFinish={async (values) => {
						if (busy || uploading || faviconBusy) return
						setBusy(true)
						try {
							await request('/panel/itemIcon/edit', { ...item, ...values })
							await client.invalidateQueries({ queryKey: ['groups'] })
							void message.success(t('common.success'))
							onClose()
						} catch (err) {
							error(err)
						} finally {
							setBusy(false)
						}
					}}
				>
					<div className="item-editor-main-grid">
						<Form.Item name="title" label={t('common.title')} rules={[{ required: true, whitespace: true }]}>
							<Input maxLength={200} />
						</Form.Item>
						<Form.Item name="itemIconGroupId" label={t('iconItem.iconGroup')} rules={[{ required: true }]}>
							<Select
								options={groups.map((g) => ({ value: g.id, label: g.title }))}
							/>
						</Form.Item>
						<Form.Item
							name="url"
							label={t('iconItem.url')}
							dependencies={['lanUrl']}
							rules={[
								urlRule,
								{
									validator: () =>
										form.getFieldValue('url') || form.getFieldValue('lanUrl')
											? Promise.resolve()
											: Promise.reject(new Error(t('review.addressRequired'))),
								},
							]}
						>
							<Input placeholder="https://" maxLength={1000} />
						</Form.Item>
						<Form.Item
							name="lanUrl"
							label={t('iconItem.lanUrl')}
							rules={[urlRule]}
							extra={t('review.addressHelp')}
						>
							<Input placeholder="http://192.168.1.10:8080" maxLength={1000} />
						</Form.Item>
						<Form.Item name="description" label={t('common.description')}>
							<Input.TextArea rows={2} maxLength={300} />
						</Form.Item>
						<Form.Item name="openMethod" label={t('iconItem.openMethod')}>
							<Select
								options={[
									{ value: 1, label: t('iconItem.currentPageOpen') },
									{ value: 2, label: t('iconItem.newWindowOpen') },
									{ value: 3, label: t('iconItem.currentPageLayerOpen') },
								]}
							/>
						</Form.Item>
					</div>
					<div className="item-editor-icon-grid">
						<Form.Item name={['icon', 'itemType']} label={t('ui.iconType')}>
							<Select
								options={[
									{ value: 1, label: t('ui.textIcon') },
									{ value: 2, label: t('ui.imageIcon') },
									{ value: 3, label: 'Iconify' },
								]}
							/>
						</Form.Item>
						{type === 2 ? (
							<>
								<Form.Item
									name={['icon', 'src']}
									label={t('iconItem.inputIconUrlOrUpload')}
									rules={[urlRule]}
								>
									<Input />
								</Form.Item>
								<Space wrap className="item-editor-upload-actions">
									<ImageUpload
										disabled={busy || faviconBusy}
										onUploadingChange={setUploading}
										onStart={() => {
											const version = iconDraftVersionRef.current
											return (url) => {
												if (
													form.getFieldValue(['icon', 'itemType']) !== 2 ||
													iconDraftVersionRef.current !== version
												)
													return
												form.setFieldValue(['icon', 'src'], url)
												setDirty(true)
											}
										}}
									/>
									<Button
										loading={faviconBusy}
										disabled={busy || uploading}
										onClick={async () => {
											const url = form.getFieldValue('url') || form.getFieldValue('lanUrl')
											const previousIcon = form.getFieldValue(['icon', 'src'])
											const version = iconDraftVersionRef.current
											if (!isSafeNavigationUrl(url || '')) return error(new Error(t('review.invalidUrl')))
											setFaviconBusy(true)
											try {
												const data = await request<{ iconUrl: string }>('/panel/itemIcon/getSiteFavicon', {
													url,
												})
												if (!data.iconUrl) throw new Error(t('iconItem.geticonFail'))
												if (
													form.getFieldValue(['icon', 'itemType']) === 2 &&
													(form.getFieldValue('url') || form.getFieldValue('lanUrl')) === url &&
													form.getFieldValue(['icon', 'src']) === previousIcon &&
													iconDraftVersionRef.current === version
												) {
													form.setFieldValue(['icon', 'src'], data.iconUrl)
													setDirty(true)
												}
											} catch (err) {
												error(err)
											} finally {
												setFaviconBusy(false)
											}
										}}
									>
										{t('iconItem.getIcon')}
									</Button>
								</Space>
							</>
						) : (
							<Form.Item
								name={['icon', 'text']}
								label={type === 3 ? t('iconItem.inputIconName') : t('ui.textIcon')}
							>
								<Input placeholder={type === 3 ? 'mdi:server' : 'Z'} maxLength={type === 3 ? 100 : 4} />
							</Form.Item>
						)}
						<Form.Item
							className="item-editor-icon-background"
							name={['icon', 'backgroundColor']}
							label={t('ui.iconBackground')}
						>
							<Input placeholder="#eef0ff" />
						</Form.Item>
					</div>
				</Form>
			</ConfigProvider>
		</Modal>
	)
}
