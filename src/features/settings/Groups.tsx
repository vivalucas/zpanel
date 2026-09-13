import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Button, Empty, Form, Input, Modal, Space, Tag } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useGroups } from '@/lib/queries'
import { Loading, QueryError, Section } from '@/components/shared'
import { SortableGrid } from '@/components/Sortable'
export default function Groups() {
	const request = useSessionRequest()
	const groups = useGroups()
	const client = useQueryClient()
	const { t, error, modal } = useFeedback()
	const [editing, setEditing] = useState<Panel.ItemIconGroup | null>(null)
	const [busy, setBusy] = useState(false)
	const [form] = Form.useForm()
	const refresh = () => client.invalidateQueries({ queryKey: ['groups'] })
	if (groups.isPending) return <Loading />
	if (groups.error) return <QueryError error={groups.error} retry={() => groups.refetch()} />
	const edit = (group: Panel.ItemIconGroup) => {
		form.setFieldsValue({ title: '', ...group })
		setEditing(group)
	}
	return (
		<Section
			title={t('ui.groups')}
			description={t('ui.groupsDescription')}
			extra={
				<Button type="primary" icon={<PlusOutlined aria-hidden="true" />} onClick={() => edit({})}>
					{t('common.add')}
				</Button>
			}
		>
			{groups.data.length ? (
				<SortableGrid
					className="group-list"
					items={groups.data}
					disabled={busy}
					onSort={async (sorted) => {
						setBusy(true)
						try {
							await request('/panel/itemIconGroup/saveSort', {
								sortItems: sorted.map((g, sort) => ({ id: g.id, sort })),
							})
							await refresh()
						} catch (err) {
							error(err)
						} finally {
							setBusy(false)
						}
					}}
				>
					{(group) => (
						<div className="group-row">
							<div>
								<strong>{group.title}</strong>
								<Tag>{group.items.length}</Tag>
							</div>
							<Space>
								<Button
									aria-label={t('common.edit')}
									icon={<EditOutlined aria-hidden="true" />}
									onClick={() => edit(group)}
								/>
								<Button
									danger
									aria-label={t('common.delete')}
									icon={<DeleteOutlined aria-hidden="true" />}
									onClick={() =>
										modal.confirm({
											title: t('ui.deleteGroup'),
											content: t('ui.deleteGroupDescription', { title: group.title }),
											okButtonProps: { danger: true },
											onOk: async () => {
												try {
													await request('/panel/itemIconGroup/deletes', { ids: [group.id] })
													await refresh()
												} catch (err) {
													error(err)
													throw err
												}
											},
										})
									}
								/>
							</Space>
						</div>
					)}
				</SortableGrid>
			) : (
				<Empty />
			)}
			<Modal
				open={!!editing}
				title={t(editing?.id ? 'common.edit' : 'common.add')}
				onCancel={() => setEditing(null)}
				onOk={() => form.submit()}
				confirmLoading={busy}
			>
				<Form
					form={form}
					disabled={busy}
					layout="vertical"
					onFinish={async (values) => {
						setBusy(true)
						try {
							await request('/panel/itemIconGroup/edit', { id: editing?.id, ...values })
							await refresh()
							setEditing(null)
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
				</Form>
			</Modal>
		</Section>
	)
}
