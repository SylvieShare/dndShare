import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createRichNodeHtml, decodeRichNodePayload } from '@sylvieshare/share-ui'

const inputSource = readFileSync(fileURLToPath(new URL('./InputDescription.vue', import.meta.url)), 'utf8')
const inlineSource = readFileSync(fileURLToPath(new URL('./DndRichInlineNode.vue', import.meta.url)), 'utf8')
const migrationSource = readFileSync(fileURLToPath(new URL('../../../../internal/store/schema/15_rich_content.sql', import.meta.url)), 'utf8')

describe('DnD rich content integration', () => {
  it('uses an application-owned payload instead of legacy custom elements', () => {
    const html = createRichNodeHtml('dice', { formula: '2к6 + 3', label: 'Урон' }, 'Урон: 2к6 + 3')
    const encoded = html.match(/data-rich-payload="([^"]+)"/)?.[1]
    expect(decodeRichNodePayload(encoded)).toEqual({ formula: '2к6 + 3', label: 'Урон' })
    expect(html).not.toContain('dice-roller')
  })

  it('offers insert and edit flows for all DnD node kinds', () => {
    expect(inputSource).toContain("openCreate('dice')")
    expect(inputSource).toContain("openCreate('item')")
    expect(inputSource).toContain("openCreate('suggest')")
    expect(inputSource).toContain('@node-select="selectNode"')
    expect(inputSource).toContain('updateRichNode')
    expect(inputSource).toContain('removeRichNode')
  })

  it('connects nodes to dice, item preview/modal and suggest description behaviour', () => {
    expect(inlineSource).toContain('diceStore.roll')
    expect(inlineSource).toContain(':size="27"')
    expect(inlineSource).toContain('vertical-align: middle')
    expect(inlineSource).toContain('<ItemTooltip')
    expect(inlineSource).toContain('<ItemViewModal')
    expect(inlineSource).toContain('<BasePopover')
  })

  it('migrates only the approved kobold example', () => {
    expect(migrationSource).toContain('WHERE id = 1635')
    expect(migrationSource).toContain('data-rich-node="dice"')
    expect(migrationSource).toContain('data-rich-node="suggest"')
    expect(migrationSource).not.toMatch(/UPDATE dndshare\.item\s*;/)
  })
})
