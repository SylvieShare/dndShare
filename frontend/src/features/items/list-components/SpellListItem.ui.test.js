import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const spellSource = readFileSync(fileURLToPath(new URL('./SpellListItem.vue', import.meta.url)), 'utf8')
const listSource = readFileSync(fileURLToPath(new URL('../../handbook/components/HandbookItemList.vue', import.meta.url)), 'utf8')

describe('handbook spell tile rune', () => {
  it('fills the tile height with a 64 px raster rune', () => {
    expect(spellSource).toContain('v-if="item.iconImageUrl"')
    expect(spellSource).toContain('class="sli-rune"')
    expect(spellSource).toContain(':size="64"')
    expect(listSource).toContain("'list-row-spell': type.id === 5")
    expect(listSource).toContain('.list-row-rich.list-row-spell')
    expect(listSource).toContain('min-height: 66px')
    expect(listSource).toContain('padding-top: 0')
    expect(listSource).toContain('padding-bottom: 0')
  })

  it('keeps the compact type icon as the fallback', () => {
    expect(spellSource).toContain('v-else class="sli-type-icon"')
    expect(spellSource).toContain('.sli-type-icon { display: none; }')
    expect(spellSource).not.toContain('.sli-rune { display: none; }')
  })
})
