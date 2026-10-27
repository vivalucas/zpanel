import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormInstance } from 'antd'
import { useFeedback } from './feedback'

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'invalid'

const messageKey = 'settings-auto-save'

// A page with several forms only announces success once all of its drafts are saved.
export function useAutoSaveFeedback(states: { dirty: boolean; status: AutoSaveStatus; failure: unknown }[]) {
	const feedback = useFeedback()
	const latestRef = useRef(feedback)
	const notificationRef = useRef<'saved' | 'error' | null>(null)
	const dirty = states.some((state) => state.dirty)
	const failed = states.find((state) => state.status === 'error')
	const hasFailure = !!failed
	const failure = failed?.failure
	const hasSaved = states.some((state) => state.status === 'saved')
	useEffect(() => {
		latestRef.current = feedback
	})
	useEffect(() => {
		const { error, message, t } = latestRef.current
		if (hasFailure) {
			error(failure, messageKey, 0)
			notificationRef.current = 'error'
		} else if (!dirty && hasSaved) {
			void message.success({ key: messageKey, content: t('ui.saved') })
			notificationRef.current = 'saved'
		} else if (dirty && notificationRef.current === 'saved') {
			message.destroy(messageKey)
			notificationRef.current = null
		}
	}, [dirty, hasFailure, failure, hasSaved])
	useEffect(
		() => () => {
			if (notificationRef.current === 'error') latestRef.current.message.destroy(messageKey)
		},
		[],
	)
}

export function useAutoSave<T>({
	form,
	save,
	paused = false,
	enabled = true,
	notify = true,
}: {
	form: FormInstance<T>
	save: (values: T) => Promise<void>
	paused?: boolean
	enabled?: boolean
	notify?: boolean
}) {
	const { error, message, t } = useFeedback()
	const [revision, setRevision] = useState(0)
	const [savedRevision, setSavedRevision] = useState(0)
	const [saving, setSaving] = useState(false)
	const [status, setStatus] = useState<AutoSaveStatus>('idle')
	const [failure, setFailure] = useState<unknown>(null)
	const revisionRef = useRef(0)
	const activeRef = useRef(false)
	const latestRef = useRef({ form, save, paused, enabled, notify, error, message, t })
	useEffect(() => {
		latestRef.current = { form, save, paused, enabled, notify, error, message, t }
	})
	useEffect(() => {
		activeRef.current = true
		return () => {
			activeRef.current = false
		}
	}, [])
	const changed = useCallback(() => {
		revisionRef.current++
		setRevision(revisionRef.current)
		setStatus('pending')
	}, [])
	const retry = useCallback(() => {
		if (revision !== savedRevision) setStatus('pending')
	}, [revision, savedRevision])
	useEffect(() => {
		if (!enabled || paused || saving || revision === savedRevision || status !== 'pending') return
		const timer = window.setTimeout(async () => {
			const currentRevision = revisionRef.current
			setSaving(true)
			setStatus('saving')
			let validated = false
			try {
				const values = await latestRef.current.form.validateFields()
				if (!activeRef.current) return
				// Validation may be asynchronous. Never send a superseded or paused draft.
				if (
					currentRevision !== revisionRef.current ||
					latestRef.current.paused ||
					!latestRef.current.enabled
				) {
					setStatus('pending')
					return
				}
				validated = true
				await latestRef.current.save(values)
				if (!activeRef.current) return
				setSavedRevision(currentRevision)
				if (currentRevision === revisionRef.current) {
					setStatus('saved')
					if (latestRef.current.notify)
						void latestRef.current.message.success({
							key: messageKey,
							content: latestRef.current.t('ui.saved'),
						})
				} else setStatus('pending')
			} catch (err) {
				if (!activeRef.current) return
				if (!validated) setStatus(currentRevision === revisionRef.current ? 'invalid' : 'pending')
				else {
					// A failed write keeps the draft and waits for an edit or explicit retry.
					setStatus(currentRevision === revisionRef.current ? 'error' : 'pending')
					setFailure(err)
					if (latestRef.current.notify) latestRef.current.error(err, messageKey)
				}
			} finally {
				if (activeRef.current) setSaving(false)
			}
		}, 600)
		return () => window.clearTimeout(timer)
	}, [enabled, paused, saving, revision, savedRevision, status])
	return { dirty: revision !== savedRevision, saving, status, failure, changed, retry }
}
