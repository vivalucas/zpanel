import { App } from 'antd'
import { useTranslation } from 'react-i18next'
import { ApiError } from './api'
import { useEffect, useMemo, useRef } from 'react'

export function useFeedback() {
	const { message, modal } = App.useApp()
	const { t } = useTranslation()
	const activeRef = useRef(true)
	const dialogsRef = useRef(new Set<ReturnType<typeof modal.confirm>>())
	useEffect(() => {
		activeRef.current = true
		const pending = dialogsRef.current
		return () => {
			activeRef.current = false
			pending.forEach((dialog) => dialog.destroy())
			pending.clear()
		}
	}, [])
	const scopedModal = useMemo(
		() => ({
			...modal,
			confirm: (config: Parameters<typeof modal.confirm>[0]) => {
				const dialog = modal.confirm({
					...config,
					onOk: (...args) => (activeRef.current ? config.onOk?.(...args) : undefined),
					afterClose: () => {
						dialogsRef.current.delete(dialog)
						config.afterClose?.()
					},
				})
				dialogsRef.current.add(dialog)
				return dialog
			},
		}),
		[modal],
	)
	const error = (err: unknown, messageKey?: string, duration?: number) => {
		if (!activeRef.current) return
		if (err instanceof DOMException && err.name === 'AbortError') return
		const key = err instanceof ApiError ? `apiErrorCode.${err.code}` : ''
		const content = key && t(key) !== key ? t(key) : err instanceof Error ? err.message : t('common.failed')
		void message.error(messageKey ? { key: messageKey, content, duration } : content)
	}
	return { message, modal: scopedModal, error, t }
}
