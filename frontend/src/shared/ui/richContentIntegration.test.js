import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createRichNodeHtml, decodeRichNodePayload } from '@sylvieshare/share-ui'

const inputSource = readFileSync(fileURLToPath(new URL('./InputDescription.vue', import.meta.url)), 'utf8')
const inlineSource = readFileSync(fileURLToPath(new URL('./DndRichInlineNode.vue', import.meta.url)), 'utf8')
const contentSource = readFileSync(fileURLToPath(new URL('./DndRichContent.vue', import.meta.url)), 'utf8')
const themeSource = readFileSync(fileURLToPath(new URL('../../app/theme.css', import.meta.url)), 'utf8')
const enemySource = readFileSync(fileURLToPath(new URL('../../features/items/detail-components/EnemyDetailContent.vue', import.meta.url)), 'utf8')
const itemModalSource = readFileSync(fileURLToPath(new URL('../../features/handbook/components/ItemViewModal.vue', import.meta.url)), 'utf8')
const itemDetailSource = readFileSync(fileURLToPath(new URL('../../features/handbook/components/HandbookItemDetail.vue', import.meta.url)), 'utf8')
const migrationSource = readFileSync(fileURLToPath(new URL('../../../../internal/store/schema/15_rich_content.sql', import.meta.url)), 'utf8')

describe('DnD rich content integration', () => {
  it('uses an application-owned payload instead of legacy custom elements', () => {
    const html = createRichNodeHtml('dice', { formula: '2к6 + 3', label: 'Урон', average: 10 }, 'Урон: 10 · 2к6 + 3')
    const encoded = html.match(/data-rich-payload="([^"]+)"/)?.[1]
    expect(decodeRichNodePayload(encoded)).toEqual({ formula: '2к6 + 3', label: 'Урон', average: 10 })
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
    expect(inlineSource).toContain('rich-node-average')
    expect(inlineSource).toContain('class="rich-node-or"')
    expect(inlineSource.indexOf('v-for="(part, index) in diceParts"')).toBeLessThan(inlineSource.indexOf('class="rich-node-average"'))
    expect(inlineSource).toContain('<ItemTooltip')
    expect(inlineSource).toContain('<ItemViewModal')
    expect(inlineSource).toContain('<BasePopover')
  })

  it('passes a creature name into embedded dice rolls', () => {
    expect(enemySource).toContain(':actor-name="actorName || item.name"')
    expect(contentSource).toContain(':actor-name="actorName"')
    expect(inlineSource).toContain("actor: props.actorName ? { name: props.actorName, charUuid: null } : undefined")
    expect(inlineSource).toContain(':actor-name="actorName"')
    expect(itemModalSource).toContain(':actor-name="actorName"')
    expect(itemDetailSource).toContain(':actor-name="actorName"')
  })

  it('uses the editorial prose font for rendered descriptions', () => {
    expect(contentSource).toContain('class="dnd-rich-content"')
    expect(themeSource).toContain('--font-prose: "Literata"')
    expect(themeSource).toContain('body .rc.dnd-rich-content')
  })

  it('migrates only the approved kobold example', () => {
    expect(migrationSource).toContain('WHERE id = 1635')
    expect(migrationSource).toContain('data-rich-node="dice"')
    expect(migrationSource).toContain('data-rich-node="suggest"')
    expect(migrationSource).not.toMatch(/UPDATE dndshare\.item\s*;/)
  })
})
