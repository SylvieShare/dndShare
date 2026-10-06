import fs from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const dir = path.resolve(process.argv[2] || 'target/dist')
const budgets = JSON.parse(await fs.readFile(new URL('./bundle-budgets.json', import.meta.url), 'utf8'))
const manifest = JSON.parse(await fs.readFile(path.join(dir, '.vite/manifest.json'), 'utf8'))
const initial = new Set()
function visit(key) {
  const chunk = manifest[key]
  if (!chunk || initial.has(chunk.file)) return
  initial.add(chunk.file)
  chunk.css?.forEach(file => initial.add(file))
  chunk.imports?.forEach(visit)
}
visit('index.html')
const html = await fs.readFile(path.join(dir, 'index.html'), 'utf8')
for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:css|js))"/g)) initial.add(match[1].replace(/^\//, ''))
// Basis is a worker dependency fetched only for KTX2, not a navigation chunk.
const decoderFiles = ['js', 'wasm'].map(extension => {
  const key = `node_modules/three/examples/jsm/libs/basis/basis_transcoder.${extension}`
  const asset = manifest[key]
  if (!asset || asset.src !== key || asset.isEntry || asset.isDynamicEntry || asset.imports?.length) {
    throw new Error(`Missing or unexpected Basis decoder asset: ${key}`)
  }
  return asset.file
})
const files = (await fs.readdir(dir, {recursive: true})).filter(file => /\.(js|css)$/.test(file) && !decoderFiles.includes(file))
const sizes = await Promise.all(files.map(async file => ({file, gzip: gzipSync(await fs.readFile(path.join(dir, file))).length})))
const decoderSizes = await Promise.all(decoderFiles.map(async file => gzipSync(await fs.readFile(path.join(dir, file))).length))
const measured = {
  initialGzip: sizes.filter(row => initial.has(row.file)).reduce((sum, row) => sum + row.gzip, 0),
  totalGzip: sizes.reduce((sum, row) => sum + row.gzip, 0),
  textureDecoderGzip: decoderSizes.reduce((sum, bytes) => sum + bytes, 0),
}
let failed = false
for (const extension of ['js', 'css']) {
  const count = files.filter(file => file.endsWith(`.${extension}`)).length
  if (count !== 1) {
    console.error(`Expected one ${extension.toUpperCase()} bundle, found ${count}. Code splitting must stay disabled.`)
    failed = true
  }
}
// Vite can retain self-references in dynamicImports after inlining them.
if (Object.values(manifest).some(chunk => [...(chunk.imports || []), ...(chunk.dynamicImports || [])]
    .some(key => manifest[key]?.file !== chunk.file))
    || measured.initialGzip !== measured.totalGzip) {
  console.error('All JS and CSS must load with the entry page, without additional runtime chunks.')
  failed = true
}
for (const [key, bytes] of Object.entries(measured)) {
  console.log(`${key}: ${bytes} / ${budgets[key]} bytes`)
  if (bytes > budgets[key]) failed = true
}
if (failed) { console.error('Bundle check failed. Inspect the output and import graph before changing the budget.'); process.exitCode = 1 }
