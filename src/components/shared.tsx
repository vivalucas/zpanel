import { Alert, Button, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/lib/api'
import type { ReactNode } from 'react'

export function Loading() {
	return (
		<div className="loading-state">
			<Spin size="large" />
		</div>
	)
}
export function QueryError({ error, retry }: { error: unknown; retry?: () => unknown }) {
	const { t } = useTranslation()
	const key = error instanceof ApiError ? `apiErrorCode.${error.code}` : ''
	return (
		<Alert
			type="error"
			showIcon
			title={key && t(key) !== key ? t(key) : error instanceof Error ? error.message : t('common.failed')}
			action={
				retry && (
					<Button size="small" onClick={() => retry()}>
						{t('ui.retry')}
					</Button>
				)
			}
		/>
	)
}
export function Section({
	title,
	description,
	children,
	extra,
}: {
	title: string
	description?: string
	children: ReactNode
	extra?: ReactNode
}) {
	return (
		<section className="settings-section">
			<div className="section-heading">
				<div>
					<h2>{title}</h2>
					{description && <p>{description}</p>}
				</div>
				{extra}
			</div>
			{children}
		</section>
	)
}
