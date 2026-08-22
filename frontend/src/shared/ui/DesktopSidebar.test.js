import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sidebarSource = readFileSync(fileURLToPath(new URL('./DesktopSidebar.vue', import.meta.url)), 'utf8')
const appSource = readFileSync(fileURLToPath(new URL('../../App.vue', import.meta.url)), 'utf8')
const reporterSource = readFileSync(fileURLToPath(new URL('../../features/error-report/components/ErrorReporter.vue', import.meta.url)), 'utf8')
const launcherSource = readFileSync(fileURLToPath(new URL('../../features/error-report/lib/errorReportLauncher.js', import.meta.url)), 'utf8')

describe('desktop sidebar icons', () => {
  it('starts expanded until the user saves another preference', () => {
    expect(sidebarSource).toContain(':default-expanded="true"')
    expect(sidebarSource).toContain('storage-key="dndshare-desktop-sidebar-expanded"')
  })

  it('uses a document for sessions and people for characters', () => {
    expect(sidebarSource).toMatch(/sessions:\s*ScrollText/)
    expect(sidebarSource).toMatch(/characters:\s*Users/)
    expect(sidebarSource).toMatch(/rules:\s*BookOpenCheck/)
  })

  it('uses the mascot mark as the application brand', () => {
    expect(sidebarSource).toContain('class="brand-mascot-mark"')
    expect(sidebarSource).toContain('src="/icon.svg"')
    expect(sidebarSource).not.toContain(':icon="Dices"')
  })

  it('keeps the common navigation item unlabeled', () => {
    expect(sidebarSource).not.toContain("common: 'Общее'")
    expect(sidebarSource).toContain('startsGroup(item) && groupLabel(item.group)')
  })

  it('keeps group markers in the collapsed rail so following icons do not jump', () => {
    expect(sidebarSource).not.toContain('expanded && startsGroup(item)')
    expect(sidebarSource).toContain("'sidebar-group-marker--collapsed': !expanded")
    expect(sidebarSource).toMatch(/\.sidebar-group-marker \{[\s\S]*height: 25px;[\s\S]*flex: 0 0 25px;/)
    expect(sidebarSource).toMatch(/\.sidebar-group-marker--collapsed::before \{[\s\S]*height: 1px;/)
  })

  it('reserves the full physical width of the expanded sidebar in the page layout', () => {
    expect(appSource).toMatch(/body:has\(\.app-sidebar--expanded\) \.page-transition-stage \{\s*margin-left: var\(--sidebar-expanded-w\);/)
    expect(appSource).toMatch(/\.page-transition-stage \{[\s\S]*transition: margin-left 0\.28s cubic-bezier\(0\.22, 1, 0\.36, 1\);/)
  })

  it('puts search below the brand and error reporting above the collapse toggle', () => {
    expect(sidebarSource.indexOf('<GameContextSelector :compact="!expanded" />'))
      .toBeLessThan(sidebarSource.indexOf('<HeaderSearch v-else ref="searchRef" class="sidebar-search"'))
    expect(sidebarSource.indexOf('<HeaderSearch v-else ref="searchRef" class="sidebar-search"'))
      .toBeLessThan(sidebarSource.indexOf('v-for="item in navigationItems"'))
    expect(sidebarSource).toContain('label="На странице ошибка"')
    expect(sidebarSource).toContain('.share-sidebar-tools .sidebar-error-action) { order: 1; }')
    expect(sidebarSource).toContain('.share-sidebar-tools .sidebar-toggle) { order: 2; }')
    expect(reporterSource).not.toContain('class="report-button"')
    expect(reporterSource).toContain('window.addEventListener(ERROR_REPORT_REQUEST_EVENT, startSelection)')
    expect(launcherSource).toContain('window.dispatchEvent(new Event(ERROR_REPORT_REQUEST_EVENT))')
  })

  it('uses the selected edition for the rules navigation target', () => {
    expect(sidebarSource).toContain('rulesTo: gameContextStore.rulesPath')
  })

  it('expands the collapsed sidebar and focuses search from its search action', () => {
    expect(sidebarSource).toContain('<template #default="{ expanded, toggle }">')
    expect(sidebarSource).toContain('@click="openSearch(toggle)"')
    expect(sidebarSource).toContain('searchRef.value?.focus()')
  })

  it('shows search results beside the expanded sidebar without clipping them', () => {
    expect(sidebarSource).toMatch(/\.sidebar-search \.hs-dropdown\) \{\s*inset: 0 auto auto calc\(100% \+ 12px\);/)
    expect(sidebarSource).toMatch(/\.share-sidebar-nav:has\(\.sidebar-search \.hs-dropdown\)\) \{\s*overflow: visible;/)
  })
})
