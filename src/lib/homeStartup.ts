import { useSyncExternalStore } from 'react'

type StartupTone = 'light' | 'dark'

function currentTone(): StartupTone {
	return document.documentElement.dataset.startupTone === 'light' ? 'light' : 'dark'
}

function subscribe(onChange: () => void) {
	const observer = new MutationObserver(onChange)
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-startup-tone'] })
	return () => observer.disconnect()
}

export function useStartupTone() {
	return useSyncExternalStore(subscribe, currentTone, currentTone)
}

// Only a brightness hint is public. It contains no account identity, image or URL.
export function rememberStartupTone(tone: StartupTone) {
	if (currentTone() !== tone) document.documentElement.dataset.startupTone = tone
	try {
		if (localStorage.getItem('zpanel-startup-tone') !== tone)
			localStorage.setItem('zpanel-startup-tone', tone)
	} catch {
		// Storage restrictions must not prevent the authenticated page from rendering.
	}
}
