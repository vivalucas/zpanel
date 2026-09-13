import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
import { useFeedback } from './feedback'

export function useUnsavedChanges(dirty: boolean) {
	const blocker = useBlocker(dirty)
	const { modal, t } = useFeedback()
	useEffect(() => {
		if (!dirty) return
		const beforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', beforeUnload)
		return () => window.removeEventListener('beforeunload', beforeUnload)
	}, [dirty])
	useEffect(() => {
		if (blocker.state !== 'blocked') return
		const confirm = modal.confirm({
			title: t('ui.leaveUnsaved'),
			content: t('review.unsaved'),
			onOk: () => blocker.proceed(),
			onCancel: () => blocker.reset(),
		})
		return () => confirm.destroy()
	}, [blocker, modal, t])
}
