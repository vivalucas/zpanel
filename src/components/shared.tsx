import { Alert, Button, Spin, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import { ApiError, uploadImage } from '@/lib/api'
import { useFeedback } from '@/lib/feedback'
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
/* eslint-disable react/dom-no-dangerously-set-innerhtml -- This component sanitizes all HTML with DOMPurify. */
export function SafeHtml({ html, className }: { html?: string; className?: string }) {
	// Only sanitized HTML is injected; arbitrary scripts are handled by the explicit site setting.
	return (
		<div
			className={className}
			dangerouslySetInnerHTML={{
				__html: DOMPurify.sanitize(html || '', { ADD_ATTR: ['target'], FORBID_TAGS: ['style'] }),
			}}
		/>
	)
}
/* eslint-enable react/dom-no-dangerously-set-innerhtml */
export function ImageUpload({ onChange }: { onChange: (url: string) => void }) {
	const { t, error } = useFeedback()
	return (
		<Upload
			accept=".png,.jpg,.jpeg,.webp,.gif,.ico"
			showUploadList={false}
			customRequest={async (options) => {
				try {
					const data = await uploadImage(options.file as Blob)
					onChange(data.imageUrl)
					options.onSuccess?.(data)
				} catch (err) {
					error(err)
					options.onError?.(err as Error)
				}
			}}
		>
			<Button icon={<UploadOutlined aria-hidden="true" />}>{t('iconItem.selectUpload')}</Button>
		</Upload>
	)
}
