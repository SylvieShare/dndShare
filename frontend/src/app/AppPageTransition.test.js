import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appSource = readFileSync(fileURLToPath(new URL('../App.vue', import.meta.url)), 'utf8')

describe('app page transitions', () => {
  it('hands mobile route swaps to the root View Transition when available', () => {
    expect(appSource).toContain(':css="!mobilePageTransitionActive"')
    expect(appSource).toContain('::view-transition-old(root)')
    expect(appSource).toContain('::view-transition-new(root)')
  })

  it('overlaps mobile routes without keeping the outgoing page in flow', () => {
    expect(appSource).toContain(':mode="pageTransitionMode"')
    expect(appSource).toContain("isMobile.value ? undefined : 'out-in'")
    expect(appSource).toMatch(/@media \(max-width: 768px\)[\s\S]*\.page-forward-leave-active \{[\s\S]*position: absolute;/)
    expect(appSource).toMatch(/\.page-backward-leave-active \{[\s\S]*position: absolute;[\s\S]*z-index: 2;/)
  })

  it('keeps reduced-motion navigation animation-free', () => {
    expect(appSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none;/)
    expect(appSource).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*view-transition-group\(root\)[\s\S]*animation: none;/)
  })
})
