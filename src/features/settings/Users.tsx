import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { QueryError, Section } from '@/components/shared'
export default function Users({ currentUser }: { currentUser: User.Info }) {
	const request = useSessionRequest()
	const [page, setPage] = useState(1)
	const [keyword, setKeyword] = useState('')
	const [editing, setEditing] = useState<User.Info | null>(null)
	const [busy, setBusy] = useState(false)
	const [form] = Form.useForm()
	const { t, error, modal } = useFeedback()
	const client = useQueryClient()
	const users = useQuery({
		queryKey: ['users', page, keyword],
		queryFn: ({ signal }) =>
			request<Common.ListResponse<User.Info[]>>(
				'/panel/users/getList',
				{ page, limit: 10, keyword },
				{ signal },
			),
	})
	const publicUser = useQuery({
		queryKey: ['public-user'],
		queryFn: async ({ signal }) => {
			try {
				return (await request<User.Info>('/panel/users/getPublicVisitUser', {}, { signal })).id ?? null
			} catch (err) {
				if (err instanceof ApiError && err.code === 1202) return null
				throw err
			}
		},
	})
	const refresh = () =>
		Promise.all([
			client.invalidateQueries({ queryKey: ['users'] }),
			client.invalidateQueries({ queryKey: ['public-user'] }),
			client.invalidateQueries({ queryKey: ['auth'] }),
		])
	const edit = (user: User.Info) => {
		form.setFieldsValue({ username: '', name: '', role: 2, ...user, password: '' })
		setEditing(user)
	}
	return (
		<Section
			title={t('adminSettingUsers.appName')}
			description={t('adminSettingUsers.alertText')}
			extra={
				<Button type="primary" icon={<PlusOutlined aria-hidden="true" />} onClick={() => edit({})}>
					{t('common.add')}
				</Button>
			}
		>
			<Input.Search
				placeholder={t('ui.searchUsers')}
				aria-label={t('ui.searchUsers')}
				onSearch={(value) => {
					setKeyword(value)
					setPage(1)
				}}
				allowClear
				className="table-search"
			/>
			{(users.error || publicUser.error) && (
				<QueryError error={users.error || publicUser.error} retry={() => refresh()} />
			)}
			<Table
				rowKey="id"
				loading={users.isPending}
				dataSource={users.data?.list}
				scroll={{ x: 660 }}
				pagination={{
					current: page,
					pageSize: 10,
					total: users.data?.count,
					showSizeChanger: false,
					onChange: setPage,
				}}
				columns={[
					{
						title: t('common.username'),
						dataIndex: 'username',
						render: (value, user) => (
							<Space>
								{value}
								{user.id === currentUser.id && <Tag>{t('adminSettingUsers.currentUseUsername')}</Tag>}
							</Space>
						),
					},
					{ title: t('common.nikeName'), dataIndex: 'name' },
					{
						title: t('adminSettingUsers.role'),
						dataIndex: 'role',
						render: (role) => (
							<Tag color={role === 1 ? 'blue' : 'default'}>
								{t(role === 1 ? 'common.role.admin' : 'common.role.regularUser')}
							</Tag>
						),
					},
					{
						title: t('ui.publicAccess'),
						render: (_, user) => (
							<Button
								size="small"
								loading={busy}
								disabled={publicUser.isPending || !!publicUser.error}
								type={publicUser.data === user.id ? 'primary' : 'default'}
								onClick={() =>
									modal.confirm({
										title: t('adminSettingUsers.setOrUnsetPublicMode'),
										content: user.username,
										onOk: async () => {
											setBusy(true)
											try {
												await request('/panel/users/setPublicVisitUser', {
													userId: publicUser.data === user.id ? null : user.id,
												})
												await refresh()
											} catch (err) {
												error(err)
												throw err
											} finally {
												setBusy(false)
											}
										},
									})
								}
							>
								{t(publicUser.data === user.id ? 'ui.enabled' : 'ui.disabled')}
							</Button>
						),
					},
					{
						title: t('common.action'),
						render: (_, user) => (
							<Space>
								<Button size="small" onClick={() => edit(user)}>
									{t('common.edit')}
								</Button>
								<Button
									size="small"
									danger
									disabled={user.id === currentUser.id}
									onClick={() =>
										modal.confirm({
											title: t('ui.deleteUser'),
											content: user.username,
											okButtonProps: { danger: true },
											onOk: async () => {
												try {
													await request('/panel/users/deletes', { userIds: [user.id] })
													await refresh()
												} catch (err) {
													error(err)
													throw err
												}
											},
										})
									}
								>
									{t('common.delete')}
								</Button>
							</Space>
						),
					},
				]}
			/>
			<Modal
				open={!!editing}
				title={t(editing?.id ? 'common.edit' : 'common.add')}
				confirmLoading={busy}
				onCancel={() => setEditing(null)}
				onOk={() => form.submit()}
			>
				<Form
					form={form}
					disabled={busy}
					layout="vertical"
					onFinish={async (values) => {
						setBusy(true)
						try {
							await request(editing?.id ? '/panel/users/update' : '/panel/users/create', {
								...values,
								id: editing?.id,
							})
							setEditing(null)
							await refresh()
						} catch (err) {
							error(err)
						} finally {
							setBusy(false)
						}
					}}
				>
					<Form.Item name="username" label={t('common.username')} rules={[{ required: true, min: 3 }]}>
						<Input />
					</Form.Item>
					<Form.Item name="name" label={t('common.nikeName')}>
						<Input />
					</Form.Item>
					<Form.Item name="role" label={t('adminSettingUsers.role')}>
						<Select
							options={[
								{ value: 1, label: t('common.role.admin') },
								{ value: 2, label: t('common.role.regularUser') },
							]}
						/>
					</Form.Item>
					<Form.Item
						name="password"
						label={t('login.passwordPlaceholder')}
						rules={[{ required: !editing?.id, min: 6, max: 50 }]}
					>
						<Input.Password
							autoComplete="new-password"
							placeholder={editing?.id ? t('adminSettingUsers.EditpasswordPlaceholder') : ''}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</Section>
	)
}
