import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Button, Empty, Form, Input, Modal, Select, Space, Tag, Alert } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import type { Group } from '@/lib/api'
import { useGroups } from '@/lib/queries'
import { Loading, QueryError, Section } from '@/components/shared'
import { SortableGrid } from '@/components/Sortable'
export default function Groups() {
	const request = useSessionRequest()
	const groups = useGroups()
	const client = useQueryClient()
	const { t, error } = useFeedback()
	const [editing, setEditing] = useState<Panel.ItemIconGroup | null>(null)
	const [busy, setBusy] = useState(false)
	const [form] = Form.useForm()
	const [deleting, setDeleting] = useState<Group | null>(null)
	const [moveToGroupId, setMoveToGroupId] = useState<number>(0)
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
			hideTitle
			description={t('ui.groupsDescription')}
			extra={
				<Button
					type="primary"
					disabled={busy}
					icon={<PlusOutlined aria-hidden="true" />}
					onClick={() => edit({})}
				>
					{t('common.add')}
				</Button>
			}
		>
			{groups.data.length ? (
				<SortableGrid
					className="group-list"
					items={groups.data}
					getItemLabel={(group) => group.title || t('ui.groups')}
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
							<div className="group-row-info">
								<strong title={group.title}>{group.title}</strong>
								<Tag>{group.items.length}</Tag>
							</div>
							<Space className="group-row-actions">
								<Button
									type="text"
									aria-label={t('common.edit')}
									disabled={busy}
									icon={<EditOutlined aria-hidden="true" />}
									onClick={() => edit(group)}
								/>
								<Button
									type="text"
									danger
									aria-label={t('common.delete')}
									icon={<DeleteOutlined aria-hidden="true" />}
									disabled={busy || groups.data.length < 2}
									title={groups.data.length < 2 ? t('review.keepGroup') : undefined}
									onClick={() => {
										setDeleting(group)
										setMoveToGroupId(
											group.items.length ? groups.data.find((g) => g.id !== group.id)?.id || 0 : 0,
										)
									}}
								/>
							</Space>
						</div>
					)}
				</SortableGrid>
			) : (
				<Empty />
			)}
			<Modal
				open={!!deleting}
				title={t('review.deleteGroupTitle')}
				onCancel={() => {
					if (!busy) setDeleting(null)
				}}
				cancelButtonProps={{ disabled: busy }}
				confirmLoading={busy}
				okButtonProps={{ danger: moveToGroupId === 0 }}
				onOk={async () => {
					if (!deleting || busy) return
					setBusy(true)
					try {
						await request('/panel/itemIconGroup/deletes', {
							ids: [deleting.id],
							...(moveToGroupId ? { moveToGroupId } : {}),
						})
						await refresh()
						setDeleting(null)
					} catch (err) {
						error(err)
					} finally {
						setBusy(false)
					}
				}}
			>
				<p>{t('review.deleteGroupCount', { title: deleting?.title, count: deleting?.items.length || 0 })}</p>
				{!!deleting?.items.length && (
					<Select
						className="full-width"
						aria-label={t('review.groupItemAction')}
						disabled={busy}
						value={moveToGroupId}
						onChange={setMoveToGroupId}
						options={[
							{ value: 0, label: t('review.deleteGroupItems') },
							...(groups.data || [])
								.filter((g) => g.id !== deleting?.id)
								.map((g) => ({ value: g.id, label: t('review.moveGroupItems', { title: g.title }) })),
						]}
					/>
				)}
				{moveToGroupId === 0 && (
					<Alert
						className="spaced"
						type="warning"
						showIcon
						title={t('ui.deleteGroupDescription', { title: deleting?.title })}
					/>
				)}
			</Modal>
			<Modal
				open={!!editing}
				title={t(editing?.id ? 'common.edit' : 'common.add')}
				onCancel={() => {
					if (!busy) setEditing(null)
				}}
				cancelButtonProps={{ disabled: busy }}
				onOk={() => {
					if (!busy) form.submit()
				}}
				confirmLoading={busy}
			>
				<Form
					form={form}
					disabled={busy}
					layout="vertical"
					onFinish={async (values) => {
						if (busy) return
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
						<Input maxLength={200} />
					</Form.Item>
				</Form>
			</Modal>
		</Section>
	)
}
