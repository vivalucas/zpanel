import { useSessionRequest } from '@/lib/session'
import { useFeedback } from '@/lib/feedback'
import { useState } from 'react'
import { Button, Input, Modal, Select, Space, Table, Tag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { QueryError, Section } from '@/components/shared'
export default function Docker() {
	const request = useSessionRequest()
	const [filter, setFilter] = useState('')
	const [pending, setPending] = useState<string[]>([])
	const [logsId, setLogsId] = useState<string | null>(null)
	const [lines, setLines] = useState(200)
	const { t, error, modal, message } = useFeedback()
	const containers = useQuery({
		queryKey: ['docker-containers'],
		queryFn: ({ signal }) =>
			request<Common.ListResponse<System.DockerContainer[]>>('/system/docker/containers', {}, { signal }),
	})
	const stats = useQuery({
		queryKey: ['docker-stats'],
		enabled: !!containers.data?.list.length,
		queryFn: ({ signal }) => request<System.DockerStats[]>('/system/docker/stats', {}, { signal }),
	})
	const logs = useQuery({
		queryKey: ['docker-logs', logsId, lines],
		enabled: !!logsId,
		queryFn: ({ signal }) =>
			request<{ logs: string }>('/system/docker/logs', { id: logsId, lines }, { signal }),
	})
	const refresh = () =>
		Promise.all([containers.refetch(), ...(containers.data?.list.length ? [stats.refetch()] : [])])
	const action = (row: System.DockerContainer, name: string) =>
		modal.confirm({
			title: t(`apps.dockerManager.${name}`),
			content: t('review.dockerConfirm', { name: row.names, action: t(`apps.dockerManager.${name}`) }),
			okButtonProps: { danger: ['stop', 'restart', 'pause'].includes(name) },
			onOk: async () => {
				setPending((ids) => [...ids, row.id])
				try {
					await request('/system/docker/action', { id: row.id, action: name })
					await refresh()
					void message.success(t('common.success'))
				} catch (err) {
					error(err)
					throw err
				} finally {
					setPending((ids) => ids.filter((id) => id !== row.id))
				}
			},
		})
	return (
		<Section
			title="Docker"
			description={t('ui.dockerDescription')}
			extra={
				!containers.error && (
					<Button
						icon={<ReloadOutlined aria-hidden="true" />}
						loading={containers.isFetching || stats.isFetching}
						onClick={() => refresh()}
					>
						{t('ui.refresh')}
					</Button>
				)
			}
		>
			{containers.error && !containers.data ? (
				<QueryError
					error={containers.error}
					title={t('ui.dockerListUnavailable')}
					description={t('ui.dockerConnectionHint')}
					diagnostic
					retry={() => containers.refetch()}
				/>
			) : (
				<>
					{containers.error && (
						<QueryError
							error={containers.error}
							compact
							title={t('ui.refreshFailedWithPreviousData')}
							description={t('ui.refreshPreviousDataHint')}
							diagnostic
							retry={() => containers.refetch()}
						/>
					)}
					<Input.Search
						className="table-search"
						aria-label={t('ui.searchContainers')}
						placeholder={t('ui.searchContainers')}
						allowClear
						onChange={(e) => setFilter(e.target.value)}
					/>
					{stats.error && !!containers.data?.list.length && (
						<QueryError
							error={stats.error}
							compact
							title={t('ui.dockerStatsUnavailable')}
							description={t('ui.dockerConnectionHint')}
							diagnostic
							retry={() => stats.refetch()}
						/>
					)}
					<Table
						rowKey="id"
						loading={containers.isPending}
						dataSource={containers.data?.list.filter((row) =>
							`${row.names} ${row.image}`.toLowerCase().includes(filter.toLowerCase()),
						)}
						scroll={{ x: 820 }}
						columns={[
							{
								title: t('apps.dockerManager.container'),
								dataIndex: 'names',
								render: (name, row) => (
									<div>
										<strong>{name}</strong>
										<div className="muted">{row.image}</div>
									</div>
								),
							},
							{
								title: t('apps.dockerManager.status'),
								dataIndex: 'status',
								render: (status, row) => (
									<Tag color={row.state === 'running' ? 'green' : 'default'}>{status}</Tag>
								),
							},
							{
								title: t('apps.dockerManager.resources'),
								render: (_, row) => {
									const value = stats.data?.find((s) => s.ID === row.id || row.id.startsWith(s.ID))
									return (
										<div className="mono">
											CPU {value?.CPUPerc || '—'}
											<br />
											MEM {value?.MemUsage || '—'}
											<br />
											NET {value?.NetIO || '—'}
										</div>
									)
								},
							},
							{ title: t('apps.dockerManager.ports'), dataIndex: 'ports', ellipsis: true },
							{
								title: t('common.action'),
								width: 250,
								render: (_, row) => (
									<Space wrap>
										{['start', 'stop', 'restart', 'pause', 'unpause'].map((name) => (
											<Button
												key={name}
												size="small"
												disabled={
													pending.includes(row.id) ||
													(name === 'start'
														? row.state === 'running' || row.state === 'paused'
														: name === 'unpause'
															? row.state !== 'paused'
															: name === 'pause'
																? row.state !== 'running'
																: !['running', 'paused'].includes(row.state))
												}
												onClick={() => action(row, name)}
											>
												{t(`apps.dockerManager.${name}`)}
											</Button>
										))}
										<Button size="small" onClick={() => setLogsId(row.id)}>
											{t('apps.dockerManager.logs')}
										</Button>
									</Space>
								),
							},
						]}
					/>
				</>
			)}
			<Modal
				open={!!logsId}
				title={t('apps.dockerManager.logs')}
				footer={null}
				width={900}
				onCancel={() => setLogsId(null)}
				destroyOnHidden
			>
				<Space>
					<Select
						aria-label={t('ui.logLines')}
						value={lines}
						options={[100, 200, 500, 1000].map((value) => ({ value, label: `${value}` }))}
						onChange={setLines}
					/>
					<Button loading={logs.isFetching} onClick={() => logs.refetch()}>
						{t('ui.refresh')}
					</Button>
				</Space>
				{logs.error ? (
					<QueryError
						error={logs.error}
						title={t('ui.dockerLogsUnavailable')}
						compact
						diagnostic
						retry={() => logs.refetch()}
					/>
				) : (
					<pre className="log-output">
						{logs.isPending ? t('ui.loading') : logs.data?.logs || t('ui.noLogs')}
					</pre>
				)}
			</Modal>
		</Section>
	)
}
