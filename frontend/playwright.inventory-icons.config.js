import { defineConfig } from '@playwright/test'
import base from './playwright.notifications.config.js'

export default defineConfig({
  ...base,
  testMatch: 'inventory-icons.spec.js',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5191' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5191 --strictPort',
    url: 'http://127.0.0.1:5191/tests/notifications/fixtures/inventory.html',
    reuseExistingServer: false,
  },
})
