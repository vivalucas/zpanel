import { Buffer } from 'node:buffer'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { writeCompressedAssets } from '../../scripts/static-compression'

const directories: string[] = []
afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
	const directory = await mkdtemp(path.join(tmpdir(), 'zpanel-compression-test-'))
	directories.push(directory)
	return directory
}

describe('static compression', () => {
	it('keeps original files and creates decodable smaller sidecars recursively', async () => {
		const directory = await fixture()
		await mkdir(path.join(directory, 'assets'))
		const sources = new Map<string, Buffer>()
		for (const name of ['index.html', 'sw.js', 'manifest.webmanifest', 'assets/app-12345678.js', 'assets/theme-12345678.css']) {
			const file = path.join(directory, name)
			const source = Buffer.from(`/* ${name} */\n${'const example = "repeatable fixture";\n'.repeat(100)}`)
			sources.set(name, source)
			await writeFile(file, source)
		}
		await writeCompressedAssets(directory)
		for (const name of ['index.html', 'sw.js', 'manifest.webmanifest', 'assets/app-12345678.js', 'assets/theme-12345678.css']) {
			const file = path.join(directory, name)
			const original = await readFile(file)
			expect(original).toEqual(sources.get(name))
			const gz = await readFile(`${file}.gz`)
			const br = await readFile(`${file}.br`)
			expect(gunzipSync(gz)).toEqual(original)
			expect(brotliDecompressSync(br)).toEqual(original)
			expect(gz.length).toBeLessThan(original.length)
			expect(br.length).toBeLessThan(original.length)
		}
	})

	it('skips binary files and removes stale sidecars for tiny text', async () => {
		const directory = await fixture()
		const small = path.join(directory, 'small.js')
		const binary = path.join(directory, 'image.png')
		await writeFile(small, 'small')
		await writeFile(`${small}.gz`, 'stale')
		await writeFile(`${small}.br`, 'stale')
		await writeFile(binary, Buffer.alloc(2048))
		await writeCompressedAssets(directory)
		for (const file of [`${small}.gz`, `${small}.br`, `${binary}.gz`, `${binary}.br`]) {
			await expect(stat(file)).rejects.toMatchObject({ code: 'ENOENT' })
		}
		expect(await readFile(small, 'utf8')).toBe('small')
	})
})
