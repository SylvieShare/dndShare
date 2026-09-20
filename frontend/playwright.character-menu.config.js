import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/character-menu', workers: 2, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5183', locale: 'ru-RU', headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5183', url: 'http://127.0.0.1:5183/tests/character-menu/fixture.html', reuseExistingServer: true },
})
