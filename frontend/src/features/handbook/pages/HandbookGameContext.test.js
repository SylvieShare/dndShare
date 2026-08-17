import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const landingSource = readFileSync(fileURLToPath(new URL('./HandbookLanding.vue', import.meta.url)), 'utf8')
const handbookSource = readFileSync(fileURLToPath(new URL('./ViewHandbook.vue', import.meta.url)), 'utf8')

describe('handbook game context', () => {
  it('starts from the global system and edition but keeps a local selector', () => {
    expect(landingSource).toContain('await gameContextStore.ensure()')
    expect(landingSource).toContain('props.sourceVersionId || gameContextStore.sourceVersionId')
    expect(landingSource).toContain('selectedSourceVersionId')
    expect(landingSource).toContain("emit('select-type', type, selectedSourceVersionId)")
    expect(landingSource).toContain("emit('update:source-version-id', versionID)")
    expect(landingSource).not.toContain('gameContextStore.selectVersion')
  })

  it('carries the locally selected edition into catalogue publication scope', () => {
    expect(handbookSource).toContain('q.sourceVersionId = sourceVersionId.value')
    expect(handbookSource).toContain('router.push({ query: currentQuery() })')
    expect(handbookSource).toContain("params.set('sourceVersionId', String(sourceVersionId.value))")
    expect(handbookSource).toContain('contentSourcesApi.listForVersion(sourceVersionId.value)')
    expect(handbookSource).toContain('versionForType(type, route.query.sourceVersionId)')
  })
})
