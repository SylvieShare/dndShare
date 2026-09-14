import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/performance', workers: 1, retries: 0, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5197', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5197 --strictPort', url: 'http://127.0.0.1:5197/tests/performance/interactions.html', reuseExistingServer: false },
})
