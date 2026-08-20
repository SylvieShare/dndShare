import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./CreateStepRail.vue', import.meta.url)), 'utf8')

describe('creation step rail actions', () => {
  it('places reset opposite the creation caption', () => {
    expect(source).toContain('class="rail-head"')
    expect(source).toContain('class="rail-caption">Создание')
    expect(source).toContain('class="rail-reset"')
    expect(source).toContain("$emit('reset')")
  })

  it('keeps incomplete creation as an understated bottom action', () => {
    expect(source).toContain('v-if="showIncomplete"')
    expect(source).toContain('class="rail-incomplete"')
    expect(source).toContain('Создать неполноценного')
    expect(source).toContain("$emit('create-incomplete')")
    expect(source).toContain('border-top: 1px solid')
  })
})
