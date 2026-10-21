import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/image-uploads', workers: 1, retries: 0, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5199', locale: 'ru-RU', headless: true },
  webServer: {
    timeout: 120000,
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5199',
    url: 'http://127.0.0.1:5199', reuseExistingServer: false,
  },
})
