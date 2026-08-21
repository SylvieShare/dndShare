import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndTools.vue', import.meta.url)), 'utf8')

describe('tools block', () => {
  it('stores owned tools separately while proficiency remains in the shared proficiency value', () => {
    expect(source).toContain("const TOOL_TYPE = 14")
    expect(source).toContain("const TOOL_PROFICIENCY_BUCKET = 'Инструменты'")
    expect(source).toContain('props.block.content?.proficiency_bucket')
    expect(source).toContain('charCtx.updateValues({ proficiencies })')
    expect(source).toContain('tools: next')
    expect(source).toContain('appendInventoryEntry')
  })

  it('uses ordinary handbook images at the shared item icon size', () => {
    expect(source).toContain('<InventoryItemIcon')
    expect(source).toContain(':image-url="entry.display.iconImageUrl"')
    expect(source).toContain('min-height: 80px')
  })
})
