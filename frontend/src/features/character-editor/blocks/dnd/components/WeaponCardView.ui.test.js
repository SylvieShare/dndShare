import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./WeaponCardView.vue', import.meta.url)), 'utf8')

describe('weapon card icon', () => {
  it('renders handbook image or SVG in the shared 64px slot', () => {
    expect(source).toContain("import ItemIcon from '@/features/items/components/ItemIcon.vue'")
    expect(source).toContain('weaponItem?.iconImageUrl || weaponItem?.svg')
    expect(source).toContain(':size="64"')
    expect(source).toMatch(/\.w-icon \{[^}]*flex: 0 0 64px;[^}]*width: 64px;[^}]*height: 64px;/)
  })
})
