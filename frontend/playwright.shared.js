import { defineConfig } from '@playwright/test'
import suite from './playwright.suite.config.js'

// Existing feature commands remain aliases of the same projects and servers.
export function scopedSuite(project, testMatch, options = {}) {
  const selected = suite.projects.find(entry => entry.name === project)
  if (!selected) throw new Error(`Unknown browser project: ${project}`)
  return defineConfig({ ...suite, ...options,
    webServer: suite.webServer.filter(server => server.url === selected.use.baseURL),
    projects: [{ ...selected, testMatch }] })
}
