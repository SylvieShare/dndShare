import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sidebarSource = readFileSync(fileURLToPath(new URL('./DesktopSidebar.vue', import.meta.url)), 'utf8')
const reporterSource = readFileSync(fileURLToPath(new URL('../../features/error-report/components/ErrorReporter.vue', import.meta.url)), 'utf8')
const launcherSource = readFileSync(fileURLToPath(new URL('../../features/error-report/lib/errorReportLauncher.js', import.meta.url)), 'utf8')

describe('desktop sidebar icons', () => {
  it('uses a document for sessions and people for characters', () => {
    expect(sidebarSource).toMatch(/sessions:\s*ScrollText/)
    expect(sidebarSource).toMatch(/characters:\s*Users/)
  })

  it('puts search below the brand and error reporting above the collapse toggle', () => {
    expect(sidebarSource.indexOf('<HeaderSearch v-else class="sidebar-search"'))
      .toBeLessThan(sidebarSource.indexOf('v-for="item in navigationItems"'))
    expect(sidebarSource).toContain('label="На странице ошибка"')
    expect(sidebarSource).toContain('.share-sidebar-tools .sidebar-error-action) { order: 1; }')
    expect(sidebarSource).toContain('.share-sidebar-tools .sidebar-toggle) { order: 2; }')
    expect(reporterSource).not.toContain('class="report-button"')
    expect(reporterSource).toContain('window.addEventListener(ERROR_REPORT_REQUEST_EVENT, startSelection)')
    expect(launcherSource).toContain('window.dispatchEvent(new Event(ERROR_REPORT_REQUEST_EVENT))')
  })
})
