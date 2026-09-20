import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/species', workers: 2, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5184', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5184', url: 'http://127.0.0.1:5184/tests/species/fixture.html', reuseExistingServer: true },
})
