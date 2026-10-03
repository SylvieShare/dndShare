import { defineConfig } from '@playwright/test'
import base from './playwright.notifications.config.js'

export default defineConfig({
  ...base,
  testMatch: ['inventory-motion.spec.js', 'inventory.spec.js', 'inventory-icons.spec.js'],
  use: { ...base.use, baseURL: 'http://127.0.0.1:5193' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5193 --strictPort',
    url: 'http://127.0.0.1:5193/tests/notifications/fixtures/inventory.html',
    reuseExistingServer: false,
  },
})
