import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/origin-choices', workers: 2, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5181', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5181', url: 'http://127.0.0.1:5181/tests/origin-choices/fixture.html', reuseExistingServer: true },
})
