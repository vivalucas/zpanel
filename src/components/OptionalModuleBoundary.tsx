import { Component, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Modal, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { StatusState } from './shared'

// A rejected React.lazy import stays rejected for this document. Closing a local
// interaction is safe; only a page refresh can request its module again reliably.
export class OptionalModuleBoundary extends Component<
	{ children: ReactNode; fallback: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	render() {
		return this.state.failed ? this.props.fallback : this.props.children
	}
}

export function OptionalModuleFailure({
	onCancel,
	compact = false,
}: {
	onCancel: () => void
	compact?: boolean
}) {
	const { t } = useTranslation()
	return (
		<StatusState
			error
			compact={compact}
			title={t('ui.optionalModuleFailed')}
			description={t('ui.optionalModuleRefreshHint')}
			action={
				<Space wrap>
					<Button onClick={onCancel}>{t('common.cancel')}</Button>
					<Button onClick={() => window.location.reload()}>{t('ui.refreshPage')}</Button>
				</Space>
			}
		/>
	)
}

export function OptionalModuleDialog({ title, onCancel }: { title: string; onCancel: () => void }) {
	const [open, setOpen] = useState(true)
	const close = () => setOpen(false)
	return (
		<Modal
			open={open}
			title={title}
			className="optional-module-dialog"
			footer={null}
			onCancel={close}
			// Restore the parent's trigger only after the modal has released its focus trap.
			afterClose={onCancel}
			focusTriggerAfterClose={false}
		>
			<OptionalModuleFailure onCancel={close} />
		</Modal>
	)
}
