import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import type { AutoSaveStatus as SaveStatus } from '@/lib/autoSave'

export function AutoSaveStatus({ state }: { state: { status: SaveStatus; retry: () => void } }) {
	const { t } = useTranslation()
	const key = {
		idle: 'ui.autoSave',
		pending: 'ui.autoSavePending',
		saving: 'ui.autoSaveSaving',
		saved: 'ui.saved',
		error: 'ui.autoSaveFailed',
		invalid: 'ui.autoSaveInvalid',
	}[state.status]
	return (
		<div className="auto-save-status" data-save-status={state.status}>
			<span>{t(key)}</span>
			{state.status === 'error' && (
				<Button size="small" onClick={state.retry}>
					{t('ui.retry')}
				</Button>
			)}
		</div>
	)
}
