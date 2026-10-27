import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'
import type { Plugin } from 'vite'

const gzipAsync = promisify(gzip)
const brotliAsync = promisify(brotliCompress)
const compressibleFile = /\.(?:css|html|js|json|svg|txt|webmanifest|xml)$/i

export async function writeCompressedAssets(directory: string): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true })
	await Promise.all(
		entries.map(async (entry) => {
			const file = path.join(directory, entry.name)
			if (entry.isDirectory()) return writeCompressedAssets(file)
			if (!entry.isFile() || !compressibleFile.test(entry.name)) return
			const source = await readFile(file)
			for (const [extension, compress] of [
				['gz', () => gzipAsync(source, { level: 9 })],
				['br', () => brotliAsync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })],
			] as const) {
				const output = `${file}.${extension}`
				const compressed = source.length >= 1024 ? await compress() : undefined
				if (compressed && compressed.length < source.length) await writeFile(output, compressed)
				else await rm(output, { force: true })
			}
		}),
	)
}

export function staticCompression(): Plugin {
	let outputDirectory: string
	return {
		name: 'zpanel-static-compression',
		apply: 'build',
		configResolved(config) {
			outputDirectory = path.resolve(config.root, config.build.outDir)
		},
		// Run after PWA's worker generation; sidecars do not enter its precache manifest.
		closeBundle: {
			order: 'post',
			sequential: true,
			async handler(error) {
				if (error) return
				await writeCompressedAssets(outputDirectory)
			},
		},
	}
}
