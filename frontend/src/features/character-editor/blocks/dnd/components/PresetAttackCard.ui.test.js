import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./PresetAttackCard.vue', import.meta.url)), 'utf8')

describe('preset attack card presentation', () => {
  it('uses the shared weapon-row icon and attack/damage presentation', () => {
    expect(source).toContain("import ItemIcon from '@/features/items/components/ItemIcon.vue'")
    expect(source).toContain("import AttackDamage from '@/features/character-editor/blocks/dnd/components/AttackDamage.vue'")
    expect(source).toContain(':size="64"')
    expect(source).not.toContain('SystemDie')
    expect(source).not.toContain('pac-formula')
  })

  it('keeps each preset attack as a menu-highlightable full row', () => {
    expect(source).toContain('class="pac-card action-menu-source"')
    expect(source).toContain("'action-menu-source--open': open")
    expect(source).toMatch(/\.pac-view \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/)
    expect(source).toMatch(/\.pac-main \{[^}]*min-height: 86px;/)
  })
})
