import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/global-maps', testMatch: 'workspaceEditing.spec.js', grep: /toolbar tools/, workers: 1, retries: 0, reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:5193', locale: 'ru-RU', headless: true },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5193',
    url: 'http://127.0.0.1:5193', reuseExistingServer: false,
  },
})
