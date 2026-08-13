import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndStatusOverview.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndStatusOverviewView.vue', import.meta.url)), 'utf8')
const inspirationSource = readFileSync(fileURLToPath(new URL('./components/DndInspirationEditor.vue', import.meta.url)), 'utf8')

describe('desktop status overview', () => {
  it('presents conditions, exhaustion and inspiration as one status tile', () => {
    expect(source).toContain('<BaseTile')
    expect(source).toContain(':strip="hasActiveSummary"')
    expect(viewSource).toContain('>Статусы<')
    expect(viewSource).toContain('>Состояния<')
    expect(viewSource).toContain('>Истощение<')
    expect(viewSource).toContain('>Вдохновение<')
  })

  it('omits inactive exhaustion and inspiration from the tile summary', () => {
    expect(viewSource).toContain('v-if="hasActiveMetrics"')
    expect(viewSource).toContain('v-if="exhaustionLevel > 0"')
    expect(viewSource).toContain('v-if="inspirationActive"')
    expect(viewSource).not.toContain("inspirationActive ? 'есть' : 'нет'")
    expect(viewSource).not.toContain("exhaustionLevel > 0 ? `${exhaustionLevel} ур.` : 'нет'")
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
