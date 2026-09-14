import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { gzipSync } from 'node:zlib'
import { build, preview } from 'vite'
import { chromium } from '@playwright/test'

const root = process.cwd()
const output = path.resolve(process.argv[2] || 'target/performance.json')
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dndshare-performance-'))
const appDir = path.join(temp, 'app'), fixtureDir = path.join(temp, 'fixture')
const measureFiles = async dir => {
  const files = await fs.readdir(dir, { recursive: true })
  return Promise.all(files.filter(file => /\.(js|css)$/.test(file)).map(async file => {
    const data = await fs.readFile(path.join(dir, file))
    return { file, bytes: data.length, gzip: gzipSync(data).length }
  }))
}
await build({ root, logLevel: 'error', build: { outDir: appDir, manifest: true } })
const files = await measureFiles(appDir)
const manifest = JSON.parse(await fs.readFile(path.join(appDir, '.vite/manifest.json'), 'utf8'))
const initial = new Set()
function visit(key, assets = initial) {
  const chunk = manifest[key]
  if (!chunk || assets.has(chunk.file)) return
  assets.add(chunk.file)
  chunk.css?.forEach(file => assets.add(file))
  chunk.imports?.forEach(key => visit(key, assets))
}
visit('index.html')
// With cssCodeSplit=false Vite records the global CSS outside the entry chunk.
const html = await fs.readFile(path.join(appDir, 'index.html'), 'utf8')
for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:css|js))"/g)) initial.add(match[1].replace(/^\//, ''))
const sum = rows => rows.reduce((all, file) => ({ bytes: all.bytes + file.bytes, gzip: all.gzip + file.gzip }), { bytes: 0, gzip: 0 })
const routes = {}
for (const key of Object.keys(manifest).filter(key => /View(Character|Handbook|Sessions)\.vue$/.test(key))) {
  const assets = new Set(initial)
  visit(key, assets)
  routes[key] = sum(files.filter(file => assets.has(file.file)))
}
await build({ root, logLevel: 'error', build: { outDir: fixtureDir, rolldownOptions: { input: path.join(root, 'tests/performance/fixture.html') } } })
const server = await preview({ root, logLevel: 'error', build: { outDir: fixtureDir }, preview: { host: '127.0.0.1', port: 5198, strictPort: true } })
const browser = await chromium.launch({ headless: true })
const result = { measuredAt: new Date().toISOString(), browser: browser.version(), cpuSlowdown: 4, files, routes, initial: sum(files.filter(file => initial.has(file.file))), total: sum(files), list: [], snapshots: [], character: null }
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()
    let json = { items: [] }
    if (pathname === '/api/char/benchmark') json = { templateName: 'DND5', userId: 1, sourceVersionId: 1, version: 1, publicVisible: true, data: { values: { name: 'Аудит', hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] }, STR: { value: 10 } }, var: { stats: {} } } }
    else if (pathname === '/api/suggest/batch') json = { items: {} }
    else if (pathname === '/api/account/tutorials') json = { tutorials: [false, true].map(mobile => ({ flowId: 'character', sourceKey: 'edition:1', device: mobile ? 'mobile' : 'desktop', revision: 1, status: 'completed' })) }
    else if (pathname === '/api/char/benchmark/sessions') json = { sessions: [] }
    else if (pathname === '/api/char/benchmark/journal') json = { entries: [], sections: [] }
    await route.fulfill({ json })
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const url = 'http://127.0.0.1:5198/tests/performance/fixture.html'
  await page.goto(url)
  await page.waitForFunction(() => !!window.frontendBenchmark)
  await page.evaluate(() => window.frontendBenchmark.setCount(30))
  for (const count of [500, 2000]) for (let run = 0; run < 5; run++) {
    await page.evaluate(() => window.frontendBenchmark.setCount(0))
    result.list.push(await page.evaluate(async count => {
      const start = performance.now()
      await window.frontendBenchmark.setCount(count)
      return { count, renderMs: performance.now() - start, renderedRows: document.querySelectorAll('.list-row').length, elements: document.querySelectorAll('.items-list *').length }
    }, count))
  }
  for (let run = 0; run < 5; run++) result.snapshots.push(await page.evaluate(() => window.frontendBenchmark.snapshots()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${url}?mode=character`)
  await page.locator('.sheet-scroll .morph-tile').first().waitFor()
  await page.waitForTimeout(500)
  result.character = await page.evaluate(() => ({ sheetElements: document.querySelectorAll('.sheet-scroll *').length, panes: [...document.querySelectorAll('.mobile-swipe-pane')].map(pane => ({ elements: pane.querySelectorAll('*').length, hasBlocks: !!pane.querySelector('.container > *') })) }))
  result.errors = errors
} finally {
  await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.writeFile(output, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ output, initial: result.initial, total: result.total, list: result.list, snapshots: result.snapshots, character: result.character, errors: result.errors }, null, 2))
