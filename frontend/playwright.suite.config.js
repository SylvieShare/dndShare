import { defineConfig } from '@playwright/test'

const devPort = Number(process.env.DNDSHARE_BROWSER_DEV_PORT || 15440)
const buildPort = Number(process.env.DNDSHARE_BROWSER_BUILD_PORT || 15441)
const devURL = `http://127.0.0.1:${devPort}`
const buildURL = `http://127.0.0.1:${buildPort}`
const models = process.env.DNDSHARE_TEST_MODELS === '1'
const smokeURL = process.env.DNDSHARE_SMOKE_URL
const diagnostics = /@local-model|@gpu/
const selected = process.argv.flatMap((argument, index, args) =>
  argument === '--project' ? [args[index + 1]] : argument.startsWith('--project=') ? [argument.slice(10)] : [])
const wants = name => !selected.length || selected.some(project => project === name || project.includes('*'))

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 2,
  forbidOnly: true,
  retries: 0,
  outputDir: process.env.DNDSHARE_BROWSER_OUTPUT || (models ? 'target/test-results/models' : 'test-results'),
  reporter: [['line'], ['json', { outputFile: process.env.DNDSHARE_BROWSER_REPORT || (models ? 'target/test-reports/models.json' : 'test-results/results.json') }]],
  use: { colorScheme: 'dark', locale: 'ru-RU', timezoneId: 'Europe/Moscow', headless: true },
  projects: smokeURL ? [
    { name: 'fullstack', testMatch: '**/fullstack/*.spec.js', workers: 1, use: { baseURL: smokeURL } },
  ] : models ? [
    { name: 'models', testMatch: '**/maps/*.spec.js', grep: diagnostics, workers: 1, use: { baseURL: devURL } },
  ] : [
    { name: 'ui', testIgnore: ['**/maps/**', '**/global-maps/**', '**/image-uploads/**', '**/fullstack/**'], use: { baseURL: devURL } },
    { name: 'maps', testMatch: '**/maps/*.spec.js', grepInvert: diagnostics, workers: 1, use: { baseURL: devURL } },
    { name: 'production', testMatch: ['**/global-maps/*.spec.js', '**/image-uploads/*.spec.js'], workers: 1, use: { baseURL: buildURL } },
  ],
  webServer: smokeURL ? [] : [
    ...(models || wants('ui') || wants('maps') ? [{ command: `npm run dev -- --host 127.0.0.1 --port ${devPort} --strictPort`, url: devURL, reuseExistingServer: false, timeout: 120000,
      env: { DNDSHARE_VITE_CACHE: process.env.DNDSHARE_VITE_CACHE || `target/vite-cache/${devPort}` } }] : []),
    ...(!models && wants('production') ? [{ command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${buildPort} --strictPort`, url: buildURL, reuseExistingServer: false, timeout: 120000 }] : []),
  ],
})
