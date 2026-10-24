import { useSessionRequest } from '@/lib/session'
import { passwordRule } from '@/lib/password'
import { useFeedback } from '@/lib/feedback'
import { useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { QueryError, Section } from '@/components/shared'
import { isAccessError } from '@/lib/queryState'
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
	const lastPage = users.data ? Math.max(1, Math.ceil(users.data.count / 10)) : page
	useEffect(() => {
		// Keep the request page in sync when deletion removes the last row on a page.
		// eslint-disable-next-line react/set-state-in-effect
		if (page > lastPage) setPage(lastPage)
	}, [page, lastPage])
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
	const accessQuery = isAccessError(users.error) ? users : isAccessError(publicUser.error) ? publicUser : null
	if (accessQuery) return <QueryError error={accessQuery.error} retry={() => accessQuery.refetch()} />
	return (
		<Section
			title={t('adminSettingUsers.appName')}
			hideTitle
			description={t('ui.publicAccessHelp')}
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
			{users.error && (
				<QueryError
					error={users.error}
					compact={!!users.data}
					title={users.data ? t('ui.refreshFailedWithPreviousData') : undefined}
					description={users.data ? t('ui.refreshPreviousDataHint') : undefined}
					retry={() => users.refetch()}
				/>
			)}
			{publicUser.error && (!users.error || !!users.data) && (
				<QueryError error={publicUser.error} compact retry={() => publicUser.refetch()} />
			)}
			{(!users.error || !!users.data) && (
				<Table
					rowKey="id"
					loading={users.isPending}
					dataSource={users.data?.list}
					scroll={{ x: 732 }}
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
							width: 220,
							render: (value, user) => (
								<div className="user-table-identity">
									<span title={value}>{value}</span>
									{user.id === currentUser.id && <Tag>{t('adminSettingUsers.currentUseUsername')}</Tag>}
								</div>
							),
						},
						{ title: t('common.nikeName'), dataIndex: 'name', width: 160, ellipsis: true },
						{
							title: t('adminSettingUsers.role'),
							dataIndex: 'role',
							width: 100,
							render: (role) => (
								<Tag color={role === 1 ? 'blue' : 'default'}>
									{t(role === 1 ? 'common.role.admin' : 'common.role.regularUser')}
								</Tag>
							),
						},
						{
							title: t('ui.publicAccess'),
							width: 120,
							render: (_, user) => (
								<Button
									size="small"
									loading={busy}
									disabled={publicUser.isPending || !!publicUser.error}
									type={publicUser.data === user.id ? 'primary' : 'default'}
									onClick={() =>
										modal.confirm({
											title: t('adminSettingUsers.setOrUnsetPublicMode'),
											content: t(
												publicUser.data === user.id
													? 'ui.disablePublicAccessConfirm'
													: 'ui.enablePublicAccessConfirm',
												{ username: user.username },
											),
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
							fixed: 'right',
							width: 132,
							render: (_, user) => (
								<Space>
									<Button size="small" disabled={busy} onClick={() => edit(user)}>
										{t('common.edit')}
									</Button>
									<Button
										size="small"
										danger
										disabled={busy || user.id === currentUser.id}
										onClick={() =>
											modal.confirm({
												title: t('ui.deleteUser'),
												content: user.username,
												okButtonProps: { danger: true },
												onOk: async () => {
													setBusy(true)
													try {
														await request('/panel/users/deletes', { userIds: [user.id] })
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
										{t('common.delete')}
									</Button>
								</Space>
							),
						},
					]}
				/>
			)}
			<Modal
				open={!!editing}
				title={t(editing?.id ? 'common.edit' : 'common.add')}
				confirmLoading={busy}
				onCancel={() => {
					if (!busy) setEditing(null)
				}}
				cancelButtonProps={{ disabled: busy }}
				onOk={() => {
					if (!busy) form.submit()
				}}
			>
				<Form
					form={form}
					disabled={busy}
					layout="vertical"
					onFinish={async (values) => {
						if (busy) return
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
					<Form.Item name="role" label={t('adminSettingUsers.role')} extra={t('ui.roleHelp')}>
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
						rules={[{ required: !editing?.id }, passwordRule(t('review.passwordSize'))]}
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
