import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = relative => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

describe('handbook type raster icons', () => {
  it('uses raster collection emblems across handbook navigation', () => {
    const landing = read('../pages/HandbookLanding.vue')
    const page = read('../pages/ViewHandbook.vue')
    const picker = read('./ItemPickerModal.vue')

    for (const source of [landing, page, picker]) {
      expect(source).toContain('iconImageUrl')
      expect(source).not.toContain('type.svg')
    }
  })

  it('uses a type image only after both item icon formats are absent', () => {
    const icon = read('../../items/components/ItemIcon.vue')
    expect(icon).toContain('!props.item?.iconImageUrl && !props.item?.svg')
    expect(icon).toContain('props.type?.iconImageUrl')
    expect(icon).toContain('props.item?.iconImageUrl || (usesTypeIcon.value ? props.type.iconImageUrl')
  })
})
