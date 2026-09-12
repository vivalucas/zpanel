import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loadTs(filename) {
  const exports = {}
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } })
  vm.runInNewContext(outputText, {
    exports,
    require: specifier => specifier.startsWith('.') ? loadTs(path.resolve(path.dirname(filename), `${specifier}.ts`)) : require(specifier),
    URL,
  }, { filename })
  return exports
}
const { isSafeNavigationUrl } = loadTs(path.resolve('src/utils/navigation.ts'))
for (const url of ['https://example.com', 'http://nas.local:8080', '/app', '//example.com'])
  assert.equal(isSafeNavigationUrl(url), true, url)
for (const url of ['javascript:alert(1)', ' javaScript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,test', 'file:///tmp/file', '\\\\example.com', ''])
  assert.equal(isSafeNavigationUrl(url), false, url)
const { exportJson, importJsonString, collectIconGroups } = loadTs(path.resolve('src/utils/jsonImportExport/index.ts'))
const backup = exportJson('test').addIconsData([{ title: 'Apps', sort: 0, children: [{ title: 'App', sort: 0, icon: null, url: 'https://example.com', lanUrl: '', description: '', openMethod: 1 }] }]).string()
assert.equal(importJsonString(backup).isPassCheckMd5(), true)
assert.equal(importJsonString(backup).geticons()[0].children[0].sort, 0)
for (const bad of ['null', '[]', '{', JSON.stringify({ ...JSON.parse(backup), appName: 'WrongApp' }), JSON.stringify({ ...JSON.parse(backup), icons: [{ title: 'Broken', sort: 1, children: null }] }), backup.replace('https://example.com', 'javascript:alert(1)')])
  assert.throws(() => importJsonString(bad), undefined, bad)
process.stdout.write('Navigation safety and import schema/checksum regression checks passed.\n')

await assert.rejects(collectIconGroups(async () => ({ code: 1200, msg: 'database failed' }), async () => { throw new Error('must not run') }))
await assert.rejects(collectIconGroups(async () => ({ code: 0, data: { list: [{ id: 1, title: 'Apps', sort: 0 }] } }), async () => ({ code: 1001, msg: 'expired' })))
const exported = await collectIconGroups(async () => ({ code: 0, data: { list: [{ id: 1, title: 'Apps', sort: 0 }] } }), async () => ({ code: 0, data: { list: [{ title: 'App', sort: 0, icon: null, url: 'https://example.com' }] } }))
assert.equal(exported[0].children[0].sort, 0)
process.stdout.write('Export failure and ordering regression checks passed.\n')
