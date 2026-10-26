import { defineConfig } from '@playwright/test'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const lock = require('./package-lock.json').packages
for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
  if (require(`${name}/package.json`).version !== lock[`node_modules/${name}`].version) {
    throw new Error(`Installed ${name} differs from package-lock.json; prepare dependencies again`)
  }
}

const port = Number(process.env.DNDSHARE_REVIEW_WEB_PORT)
if (!port || !process.env.DNDSHARE_UI_REVIEW_OUTPUT || !process.env.DNDSHARE_REVIEW_API) {
  throw new Error('Use python3 scripts/visual/compare.py from a prepared checkout')
}

export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'review.capture.spec.js',
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 120000,
  outputDir: `${process.env.DNDSHARE_UI_REVIEW_OUTPUT}/playwright`,
  reporter: [['line'], ['json', { outputFile: `${process.env.DNDSHARE_UI_REVIEW_OUTPUT}/playwright.json` }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    colorScheme: 'dark',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120000,
    env: { DNDSHARE_VITE_CACHE: process.env.DNDSHARE_VITE_CACHE || path.join(tmpdir(), `dndshare-ui-review-vite-${port}`) },
  },
})
