import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Never run browser tests against a developer's database or containers.
const workspace = process.cwd()
const runtime = mkdtempSync(path.join(tmpdir(), 'zpanel-react-e2e-'))
const binary = path.join(runtime, 'zpanel')
try {
  execFileSync('go', ['build', '-o', binary, 'main.go'], { cwd: path.join(workspace, 'service'), stdio: 'inherit' })
  mkdirSync(path.join(runtime, 'conf'))
  writeFileSync(path.join(runtime, 'conf/conf.ini'), '[base]\nhttp_port=16521\ndatabase_drive=sqlite\ncache_drive=memory\nqueue_drive=memory\n[sqlite]\nfile_path=./data/database/zpanel.db\n')
  symlinkSync(path.join(workspace, 'dist'), path.join(runtime, 'web'))
  const server = spawn(binary, [], { cwd: runtime, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, DOCKER_CONTEXT: '', DOCKER_HOST: 'unix:///zpanel-e2e-no-docker.sock' } })
  server.stderr.on('data', () => {})
  let stopping = false
  const stop = () => { if (!stopping) { stopping = true; server.kill('SIGTERM') } }
  process.on('SIGTERM', stop); process.on('SIGINT', stop)
  server.on('exit', code => { rmSync(runtime, { recursive: true, force: true }); process.exit(stopping ? 0 : code || 1) })
  server.on('error', err => { console.error(err); rmSync(runtime, { recursive: true, force: true }); process.exit(1) })
} catch (error) {
  rmSync(runtime, { recursive: true, force: true })
  throw error
}
