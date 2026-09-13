import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import type { Group } from '@/lib/api'
import { ImageUpload } from '@/components/shared'
import { isSafeNavigationUrl } from '@/utils/navigation'
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
	const { t, error, message } = useFeedback()
	const client = useQueryClient()
	const type = Form.useWatch(['icon', 'itemType'], form)

	const urlRule = {
		validator: (_: unknown, value: string) =>
			!value || isSafeNavigationUrl(value)
				? Promise.resolve()
				: Promise.reject(new Error(t('review.invalidUrl'))),
	}
	return (
		<Modal
			open
			title={t(item ? 'iconItem.edit' : 'iconItem.add')}
			onCancel={() => {
				if (!busy) onClose()
			}}
			cancelButtonProps={{ disabled: busy }}
			confirmLoading={busy}
			onOk={() => form.submit()}
			destroyOnHidden
		>
			<Form
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
				onFinish={async (values) => {
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
				<Form.Item name="title" label={t('common.title')} rules={[{ required: true, whitespace: true }]}>
					<Input maxLength={100} />
				</Form.Item>
				<Form.Item name="itemIconGroupId" label={t('iconItem.iconGroup')} rules={[{ required: true }]}>
					<Select options={groups.map((g) => ({ value: g.id, label: g.title }))} />
				</Form.Item>
				<Form.Item name="url" label={t('iconItem.url')} rules={[{ required: true }, urlRule]}>
					<Input placeholder="https://" />
				</Form.Item>
				<Form.Item name="lanUrl" label={t('iconItem.lanUrl')} rules={[urlRule]}>
					<Input placeholder="http://192.168.1.10:8080" />
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
						<Form.Item name={['icon', 'src']} label={t('iconItem.inputIconUrlOrUpload')} rules={[urlRule]}>
							<Input />
						</Form.Item>
						<Space wrap>
							<ImageUpload onChange={(url) => form.setFieldValue(['icon', 'src'], url)} />
							<Button
								loading={faviconBusy}
								onClick={async () => {
									const url = form.getFieldValue('url')
									if (!isSafeNavigationUrl(url || '')) return error(new Error(t('review.invalidUrl')))
									setFaviconBusy(true)
									try {
										const data = await request<{ iconUrl: string }>('/panel/itemIcon/getSiteFavicon', { url })
										if (!data.iconUrl) throw new Error(t('iconItem.geticonFail'))
										form.setFieldValue(['icon', 'src'], data.iconUrl)
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
				<Form.Item name={['icon', 'backgroundColor']} label={t('ui.iconBackground')}>
					<Input placeholder="#eef0ff" />
				</Form.Item>
			</Form>
		</Modal>
	)
}
