import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./CharacterEntryPickerModal.vue', import.meta.url)), 'utf8')

describe('character entry picker modal', () => {
  it('renders domain-neutral supplied entries and returns their values', () => {
    expect(source).toContain('<AppModalFrame')
    expect(source).toContain('v-for="entry in entries"')
    expect(source).toContain("$emit('select', entry.value)")
    expect(source).toContain(':disabled="entry.disabled"')
    expect(source).not.toContain('weapon')
    expect(source).not.toContain('spell')
  })
})
