import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/maps',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5181', locale: 'ru-RU', headless: true },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5181',
    url: 'http://127.0.0.1:5181/tests/maps/fixtures/maps.html',
    reuseExistingServer: true,
  },
})
