import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const landingSource = readFileSync(fileURLToPath(new URL('./HandbookLanding.vue', import.meta.url)), 'utf8')
const handbookSource = readFileSync(fileURLToPath(new URL('./ViewHandbook.vue', import.meta.url)), 'utf8')

describe('handbook game context', () => {
  it('uses the global system and edition without a second page selector', () => {
    expect(landingSource).toContain('await gameContextStore.ensure()')
    expect(landingSource).toContain('computed(() => gameContextStore.selectedSource)')
    expect(landingSource).toContain('computed(() => gameContextStore.sourceVersionId)')
    expect(landingSource).toContain("emit('select-type', type, selectedSourceVersionId)")
    expect(landingSource).not.toContain('hb-sidebar')
    expect(landingSource).not.toContain('gameContextStore.selectVersion')
  })

  it('carries the selected or linked edition into catalogue publication scope', () => {
    expect(handbookSource).toContain('q.sourceVersionId = sourceVersionId.value')
    expect(handbookSource).toContain('router.push({ query: currentQuery() })')
    expect(handbookSource).toContain("params.set('sourceVersionId', String(sourceVersionId.value))")
    expect(handbookSource).toContain('contentSourcesApi.listForVersion(sourceVersionId.value)')
    expect(handbookSource).toContain('versionForType(type, route.query.sourceVersionId)')
  })
})
