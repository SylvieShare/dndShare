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
const files = (await fs.readdir(dir, {recursive: true})).filter(file => /\.(js|css)$/.test(file))
const sizes = await Promise.all(files.map(async file => ({file, gzip: gzipSync(await fs.readFile(path.join(dir, file))).length})))
const measured = {
  initialGzip: sizes.filter(row => initial.has(row.file)).reduce((sum, row) => sum + row.gzip, 0),
  totalGzip: sizes.reduce((sum, row) => sum + row.gzip, 0),
}
let failed = false
for (const [key, bytes] of Object.entries(measured)) {
  console.log(`${key}: ${bytes} / ${budgets[key]} bytes`)
  if (bytes > budgets[key]) failed = true
}
if (failed) { console.error('Bundle budget exceeded. Inspect the import graph before changing the budget.'); process.exitCode = 1 }
