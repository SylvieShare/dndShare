import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const headerSource = readFileSync(fileURLToPath(new URL('./AppHeader.vue', import.meta.url)), 'utf8')
const backSource = readFileSync(fileURLToPath(new URL('./MobileHeaderBack.vue', import.meta.url)), 'utf8')
const routerSource = readFileSync(fileURLToPath(new URL('../../app/router.js', import.meta.url)), 'utf8')

describe('mobile app header navigation', () => {
  it('keeps the brand menu and omits the current page title', () => {
    expect(headerSource).toContain('<MobileHeaderBack v-if="mobileBackTarget"')
    expect(headerSource).toContain('<span>DnD Share</span>')
    expect(headerSource).toContain('class="brand-mascot-mark"')
    expect(headerSource).toContain('src="/icon.svg"')
    expect(headerSource).toContain('class="brand-menu"')
    expect(headerSource).toContain('class="brand-menu-item brand-menu-report"')
    expect(headerSource).toContain('requestErrorReport()')
    expect(headerSource).not.toContain('<HeaderSearch')
    expect(headerSource).not.toContain('header-title-inline')
  })

  it('navigates to a semantic parent without browser history', () => {
    expect(backSource).toContain('router.push(props.to)')
    expect(backSource).not.toContain('router.back')
    expect(backSource).not.toContain('window.history')
    expect(routerSource).toContain("mobileBackTo: { name: 'Sessions' }")
  })

  it('keeps rules top-level while articles return to the rules hub', () => {
    expect(routerSource).toContain("path: '/rules'")
    expect(routerSource).toContain("path: '/rules/dnd5e/2014'")
    expect(routerSource).toContain("path: '/rules/vampire-tm/v20'")
    expect(routerSource).toContain("path: '/rules/dnd5e/2014/:articleSlug'")
    expect(routerSource).toContain("section: 'rules'")
    expect(routerSource).toContain("mobileBackTo: { name: 'PlayerRules' }")
    expect(routerSource).toContain("path: '/handbook/rules'")
  })

  it('places the game context selector in the mobile header', () => {
    expect(headerSource).toContain('<GameContextSelector compact />')
    expect(headerSource).toContain('rulesTo: gameContextStore.rulesPath')
  })
})
