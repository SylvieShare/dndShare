import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/global-maps', workers: 1, retries: 0, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5196', locale: 'ru-RU', headless: true },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5196',
    url: 'http://127.0.0.1:5196', reuseExistingServer: false,
  },
})
