import { Button, Spin } from 'antd'
import { InfoOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/lib/api'
import { useState } from 'react'
import type { ReactNode } from 'react'

export function Loading() {
	return (
		<div className="loading-state">
			<Spin size="large" />
		</div>
	)
}
export function StatusState({
	title,
	description,
	action,
	detail,
	compact = false,
	error = false,
}: {
	title: string
	description?: string
	action?: ReactNode
	detail?: string
	compact?: boolean
	error?: boolean
}) {
	const { t } = useTranslation()
	return (
		<div
			className={`status-state${compact ? ' status-state-compact' : ''}`}
			role={error ? 'alert' : 'status'}
		>
			<span className="status-state-icon" aria-hidden="true">
				<InfoOutlined />
			</span>
			<div className="status-state-copy">
				<strong>{title}</strong>
				{description && <p>{description}</p>}
				{detail && detail !== description && (
					<details>
						<summary>{t('ui.errorDetails')}</summary>
						<code>{detail}</code>
					</details>
				)}
			</div>
			{action && <div className="status-state-action">{action}</div>}
		</div>
	)
}
export function QueryError({
	error,
	retry,
	title,
	description,
	compact = false,
	diagnostic = false,
}: {
	error: unknown
	retry?: () => unknown
	title?: string
	description?: string
	compact?: boolean
	diagnostic?: boolean
}) {
	const { t } = useTranslation()
	const [retrying, setRetrying] = useState(false)
	const key = error instanceof ApiError ? `apiErrorCode.${error.code}` : ''
	const known = key && t(key) !== key ? t(key) : ''
	const raw = error instanceof Error ? error.message : ''
	return (
		<StatusState
			error
			compact={compact}
			title={title || t('ui.contentUnavailable')}
			description={known || description || t('ui.loadFailedHint')}
			detail={diagnostic ? raw : undefined}
			action={
				retry && (
					<Button
						icon={<ReloadOutlined aria-hidden="true" />}
						loading={retrying}
						onClick={async () => {
							setRetrying(true)
							try {
								await retry()
							} catch {
								// The query keeps the failure visible for another attempt.
							} finally {
								setRetrying(false)
							}
						}}
					>
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
