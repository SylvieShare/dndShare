import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const formSource = readFileSync(fileURLToPath(new URL('./UserBoxFormAuth.vue', import.meta.url)), 'utf8')
const boxSource = readFileSync(fileURLToPath(new URL('./UserBox.vue', import.meta.url)), 'utf8')
const sidebarSource = readFileSync(fileURLToPath(new URL('../../../shared/ui/DesktopSidebar.vue', import.meta.url)), 'utf8')

describe('guest account actions', () => {
  it('uses a labelled login icon in the collapsed desktop sidebar', () => {
    expect(boxSource).toContain(':expanded="expanded"')
    expect(formSource).toContain("import { LogIn } from '@lucide/vue'")
    expect(formSource).toContain('<LogIn v-if="!expanded"')
    expect(formSource).toContain(`:title="expanded ? undefined : 'Войти'"`)
    expect(formSource).toContain('aria-label="Войти"')
    expect(formSource).toContain('<button v-if="expanded" class="reg-link"')
    expect(sidebarSource).not.toContain("content: '↪'")
  })
})
