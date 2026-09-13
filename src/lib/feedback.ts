import { App } from 'antd'
import { useTranslation } from 'react-i18next'
import { ApiError } from './api'

export function useFeedback() {
	const { message, modal } = App.useApp()
	const { t } = useTranslation()
	const error = (err: unknown) => {
		if (err instanceof DOMException && err.name === 'AbortError') return
		const key = err instanceof ApiError ? `apiErrorCode.${err.code}` : ''
		void message.error(
			key && t(key) !== key ? t(key) : err instanceof Error ? err.message : t('common.failed'),
		)
	}
	return { message, modal, error, t }
}
