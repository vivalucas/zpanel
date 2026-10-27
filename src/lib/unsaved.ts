import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'
import { useFeedback } from './feedback'

export function useUnsavedChanges(dirty: boolean, waitForSave = false) {
	const allowNavigationRef = useRef(false)
	const blocker = useBlocker(() => dirty && !allowNavigationRef.current)
	useEffect(() => {
		allowNavigationRef.current = false
	}, [dirty])
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
		if (!dirty) {
			blocker.proceed()
			return
		}
		// Internal navigation can wait for an automatic save without discarding the draft.
		// Failed, invalid, uploading, and manually submitted drafts still require a choice.
		if (waitForSave) return
		const confirm = modal.confirm({
			title: t('ui.leaveUnsaved'),
			content: t('review.unsaved'),
			onOk: () => blocker.proceed(),
			onCancel: () => blocker.reset(),
		})
		return () => confirm.destroy()
	}, [blocker, dirty, waitForSave, modal, t])
	// Explicit account transitions have already confirmed discarding the draft.
	// Update the blocker synchronously before changing the session and navigating.
	return () => {
		allowNavigationRef.current = true
	}
}
