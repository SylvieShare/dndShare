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

  it('shows resolved weapon proficiency on the tile', () => {
    expect(source).toContain('ctx.isWeaponProficient(entry)')
    expect(source).toContain('class="w-proficiency">Владение</span>')
  })

  it('leaves card navigation to the weapon action menu', () => {
    expect(source).not.toContain("emit('name-click')")
    expect(source).not.toContain("emit('edit')")
    expect(source).not.toContain('w-name-clickable')
    expect(source).not.toContain(':rollable="interactive"')
    expect(source).not.toContain('@roll-attack')
    expect(source).not.toContain('@roll-damage')
    expect(source).not.toContain('@roll-critical')
  })
})
