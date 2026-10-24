import type { Engine } from './api'

export function findSearchEngineIndex(list: Engine[], selected?: Engine) {
	if (!selected) return -1
	const exact = list.findIndex(
		(engine) =>
			engine.url === selected.url &&
			engine.title === selected.title &&
			(engine.iconSrc || '') === (selected.iconSrc || ''),
	)
	return exact >= 0 ? exact : list.findIndex((engine) => engine.url === selected.url)
}
