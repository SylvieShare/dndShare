import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/tutorials', fullyParallel: true, workers: 2, retries: 0, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5175', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5175', url: 'http://127.0.0.1:5175/tests/tutorials/fixtures/tutorials.html', reuseExistingServer: true },
})
