import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndStatusOverview.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndStatusOverviewView.vue', import.meta.url)), 'utf8')
const inspirationSource = readFileSync(fileURLToPath(new URL('./components/DndInspirationEditor.vue', import.meta.url)), 'utf8')

describe('desktop status overview', () => {
  it('presents effects, exhaustion and inspiration in one horizontal icon row', () => {
    expect(source).toContain('<BaseTile')
    expect(source).toContain(':strip="hasActiveSummary"')
    expect(viewSource).toContain('>Эффекты<')
    expect(viewSource).toContain('overflow-x: auto')
    expect(viewSource).toMatch(/\.dsov-icon \{[\s\S]*?width: 64px;[\s\S]*?height: 64px;/)
    expect(viewSource).toContain('Истощение {{ exhaustionLevel }}')
    expect(viewSource).toContain('Вдохновение</span>')
  })

  it('omits inactive metrics and offers a separate direct inspiration action', () => {
    expect(viewSource).toContain('v-if="exhaustionLevel > 0"')
    expect(viewSource).toContain('v-if="inspirationActive"')
    expect(viewSource).toContain('v-if="editable && !inspirationActive"')
    expect(viewSource).toContain("$emit('add-inspiration')")
    expect(source).toContain('@add-inspiration="setInspiration(true)"')
    expect(source).toContain('normalizedExhaustion.value.effects.slice(0, exhaustionLevel.value)')
  })

  it('opens the effect picker from its own add action', () => {
    expect(viewSource).toContain("$emit('add-effect')")
    expect(source).toContain('@add-effect="pickerOpen = true"')
  })

  it('opens one editor with a direct tab for every status domain', () => {
    expect(source).toContain('role="tablist"')
    expect(source).toContain("v-if=\"editorKind === 'states'\"")
    expect(source).toContain("v-else-if=\"editorKind === 'exhaustion'\"")
    for (const kind of ['states', 'exhaustion', 'inspiration']) {
      expect(viewSource).toContain(`select('${kind}')`)
    }
  })

  it('uses the shared boolean inspiration control', () => {
    expect(source).toContain('<DndInspirationEditor')
    expect(inspirationSource).toContain(':aria-pressed="active"')
    expect(inspirationSource).toContain("$emit('change', !active)")
  })
})
