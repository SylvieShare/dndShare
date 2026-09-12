import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/ability-selection', workers: 2, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5177', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5177', url: 'http://127.0.0.1:5177/tests/ability-selection/fixture.html', reuseExistingServer: true },
})
