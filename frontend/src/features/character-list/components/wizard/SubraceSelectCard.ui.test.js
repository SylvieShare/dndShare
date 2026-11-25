import SubraceSelectCard from './SubraceSelectCard.vue'
import { renderComponent } from '../../../../../tests/unit/renderComponent'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./SubraceSelectCard.vue', import.meta.url)), 'utf8')

describe('subrace select card presentation', () => {
  it('uses a landscape paired portrait and an accessible selected state', () => {
    expect(source).toContain(':alt="`Мужчина и женщина — ${title}`"')
    expect(source).toContain(':aria-pressed="selected"')
    expect(source).toContain('aspect-ratio: 3 / 2')
  })

  it('shows the plain description supplied by the picker once', async () => {
    const html = await renderComponent(SubraceSelectCard, { description: 'Эльф &amp; человек' })
    expect(html).toContain('Эльф &amp;amp; человек')
  })
})
