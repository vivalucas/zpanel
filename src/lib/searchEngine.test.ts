import { describe, expect, it } from 'vitest'
import { findSearchEngineIndex } from './searchEngine'

describe('findSearchEngineIndex', () => {
	const engines = [
		{ title: 'Alpha', url: 'https://example.com/?q=%s', iconSrc: '/alpha.png' },
		{ title: 'Beta', url: 'https://example.com/?q=%s', iconSrc: '/beta.png' },
	]
	it('keeps the selected object when multiple engines use one URL', () => {
		expect(findSearchEngineIndex(engines, { ...engines[1] })).toBe(1)
		const sameTitles = engines.map((engine) => ({ ...engine, title: 'Shared name' }))
		expect(findSearchEngineIndex(sameTitles, { ...sameTitles[1] })).toBe(1)
	})
	it('recovers older defaults by URL when their display information changed', () => {
		expect(findSearchEngineIndex(engines, { title: 'Old name', url: engines[0].url })).toBe(0)
		expect(findSearchEngineIndex(engines, { title: 'Missing', url: 'https://missing.test/' })).toBe(-1)
		expect(findSearchEngineIndex(engines)).toBe(-1)
	})
})
