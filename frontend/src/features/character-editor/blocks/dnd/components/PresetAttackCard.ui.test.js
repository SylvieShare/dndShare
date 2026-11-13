import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./PresetAttackCard.vue', import.meta.url)), 'utf8')

describe('preset attack card presentation', () => {
  it('uses the shared weapon-row icon and attack/damage presentation', () => {
    expect(source).toContain("import ItemIcon from '@/features/items/components/ItemIcon.vue'")
    expect(source).toContain("import WeaponMetricsTable from './WeaponMetricsTable.vue'")
    expect(source).toContain(':size="layoutTokens[\'weapon-card-icon\']"')
    expect(source).not.toContain('SystemDie')
    expect(source).not.toContain('pac-formula')
  })

  it('opens the matching roll menu from the shared metric controls', () => {
    expect(source).toContain('class="pac-card"')
    expect(source).toContain('@roll="openMenu"')
    expect(source).toContain(':roll-scope="selection?.scope"')
    expect(source).toContain('<WeaponCardLayout>')
    expect(source).toContain('<template #controls>')
  })
})
