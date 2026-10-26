import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const exec = promisify(execFile)
const checker = fileURLToPath(new URL('./check-bundle.mjs', import.meta.url))
const decoder = 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.'

async function fixture(t, { oversized = false, extraChunk = false, missingWorker = false, missingDecoder = false } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dndshare-bundle-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  await fs.mkdir(path.join(dir, 'static'))
  await fs.mkdir(path.join(dir, '.vite'))
  const manifest = {
    'index.html': { file: 'static/app.js', isEntry: true, css: ['static/app.css'] },
  }
  const source = size => oversized ? `/*${randomBytes(size).toString('base64')}*/` : '/* fixture */'
  await fs.writeFile(path.join(dir, 'index.html'), '<script src="/static/app.js"></script><link href="/static/app.css">')
  await fs.writeFile(path.join(dir, 'static/app.js'), source(1600000))
  await fs.writeFile(path.join(dir, 'static/app.css'), 'body {}')
  for (const extension of ['js', 'wasm']) {
    const key = decoder + extension
    if (!missingDecoder) manifest[key] = { file: `static/basis.${extension}`, src: key }
    await fs.writeFile(path.join(dir, `static/basis.${extension}`), source(200000))
  }
  if (!missingWorker) await fs.writeFile(path.join(dir, 'static/modelPicking.worker-test.js'), source(60000))
  if (extraChunk) {
    manifest['extra.js'] = { file: 'static/extra.js', isDynamicEntry: true }
    manifest['index.html'].dynamicImports = ['extra.js']
    await fs.writeFile(path.join(dir, 'static/extra.js'), 'export default 1')
  }
  await fs.writeFile(path.join(dir, '.vite/manifest.json'), JSON.stringify(manifest))
  return dir
}

test('large application, decoder and worker sizes are reported without blocking the build', async t => {
  const dir = await fixture(t, { oversized: true })
  const { stdout } = await exec(process.execPath, [checker, dir])
  const sizes = Object.fromEntries([...stdout.matchAll(/^(\w+): (\d+) bytes$/gm)].map(([, key, value]) => [key, Number(value)]))
  assert.ok(sizes.initialGzip > 1456000)
  assert.equal(sizes.totalGzip, sizes.initialGzip)
  assert.ok(sizes.textureDecoderGzip > 270000)
  assert.ok(sizes.geometryWorkerGzip > 55000)
})

for (const [name, options, message] of [
  ['extra navigation chunk', { extraChunk: true }, /Expected one JS bundle|without additional runtime chunks/],
  ['missing BVH worker', { missingWorker: true }, /Expected one BVH worker/],
  ['missing Basis decoder', { missingDecoder: true }, /Missing or unexpected Basis decoder asset/],
]) test(`still rejects ${name}`, async t => {
  const dir = await fixture(t, options)
  await assert.rejects(exec(process.execPath, [checker, dir]), error => {
    assert.match(error.stderr, message)
    return true
  })
})
