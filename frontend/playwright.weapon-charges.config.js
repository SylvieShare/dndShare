import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/weapon-charges', workers: 2, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5176', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5176', url: 'http://127.0.0.1:5176/tests/weapon-charges/fixture.html', reuseExistingServer: true },
})
