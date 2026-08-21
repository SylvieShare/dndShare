import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(
  fileURLToPath(new URL('./WeaponEditor.vue', import.meta.url)),
  'utf8',
)

describe('WeaponEditor UI contract', () => {
  it('does not expose a manual proficiency toggle', () => {
    expect(source).not.toContain('label="Владение"')
    expect(source).not.toContain('ToggleSwitch')
    expect(source).not.toContain("'proficient'")
  })
})
