import { useSessionRequest } from '@/lib/session'
import { bytes } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import { Progress, Skeleton, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'
import type { MonitorItem } from '@/lib/api'
import { useMonitorConfig } from '@/lib/queries'
import { QueryError } from '@/components/shared'
function MonitorCard({ item }: { item: MonitorItem }) {
	const request = useSessionRequest()
	const { t } = useTranslation()
	const query = useQuery({
		queryKey: ['monitor', item.monitorType, item.extendParam?.path],
		refetchInterval: 5000,
		queryFn: async ({ signal }) => {
			if (item.monitorType === 'cpu') {
				const value = await request<SystemMonitor.CPUInfo>('/system/monitor/getCpuState', {}, { signal })
				return {
					percent: value.usages?.length
						? value.usages.reduce((sum, n) => sum + n, 0) / value.usages.length
						: 0,
					detail: `${value.coreCount} cores`,
					name: 'CPU',
				}
			}
			const value = await request<SystemMonitor.MemoryInfo>(
				item.monitorType === 'memory'
					? '/system/monitor/getMemonyState'
					: '/system/monitor/getDiskStateByPath',
				{ path: item.extendParam?.path || '/' },
				{ signal },
			)
			return {
				percent: value.usedPercent || 0,
				detail: `${bytes(value.used)} / ${bytes(value.total)}`,
				name: t(
					item.monitorType === 'memory'
						? 'deskModule.systemMonitor.memoryState'
						: 'deskModule.systemMonitor.diskState',
				),
			}
		},
	})
	const style = item.extendParam
	return (
		<article
			className="monitor-card"
			style={{ background: style?.backgroundColor || undefined, color: style?.color || undefined }}
		>
			<div className="monitor-top">
				<span>{item.description || query.data?.name || item.monitorType.toUpperCase()}</span>
				<span className={`status-dot ${query.error ? 'offline' : ''}`} />
			</div>
			{query.isPending ? (
				<Skeleton.Input active size="small" />
			) : query.error ? (
				<Tooltip title={query.error.message}>
					<span className="muted">{t('ui.unavailable')}</span>
				</Tooltip>
			) : (
				<>
					<strong>
						{query.data.percent.toFixed(1)}
						<small>%</small>
					</strong>
					<Progress
						percent={Math.min(100, query.data.percent)}
						showInfo={false}
						strokeColor={style?.progressColor || 'var(--primary)'}
						railColor={style?.progressRailColor}
						size="small"
					/>
					<span className="monitor-detail">{query.data.detail}</span>
				</>
			)}
		</article>
	)
}
export default function MonitorCards({ showTitle }: { showTitle?: boolean }) {
	const config = useMonitorConfig()
	const { t } = useTranslation()
	if (config.error) return <QueryError error={config.error} retry={() => config.refetch()} />
	return (
		<section className="monitor-section">
			{showTitle && (
				<div className="group-heading">
					<h2>{t('deskModule.systemMonitor.systemState')}</h2>
				</div>
			)}
			<div className="monitor-grid">
				{config.data?.list.map((item) => (
					<MonitorCard key={item.key} item={item} />
				))}
			</div>
		</section>
	)
}
