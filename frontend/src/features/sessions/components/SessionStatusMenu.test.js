import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import SessionStatusMenu from './SessionStatusMenu.vue'

const source = readFileSync(fileURLToPath(new URL('./SessionStatusMenu.vue', import.meta.url)), 'utf8')

describe('SessionStatusMenu', () => {
  it('compiles the status menu component', () => {
    expect(SessionStatusMenu).toBeTruthy()
  })

  it('uses the three-bar menu trigger and lists status choices', () => {
    expect(source).toContain('class="session-menu-btn"')
    expect(source.match(/class="bar"/g)).toHaveLength(3)
    expect(source).toContain('v-for="opt in STATUS_OPTIONS"')
    expect(source).toContain('status-option--active')
  })

  it('persists the choice through the session status composable and emits it', () => {
    expect(source).toContain('useSessionStatus')
    expect(source).toContain('await persistStatus(key)')
    expect(source).toContain("emit('status-change', sessionRef.value.status)")
  })
})
