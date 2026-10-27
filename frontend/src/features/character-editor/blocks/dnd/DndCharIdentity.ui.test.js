import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import DndCharIdentity from './DndCharIdentity.vue'
import CharacterBlock from '../../components/CharacterBlock.vue'
import definition from '../../settings/dnd/definition'
import { sheetBlock } from '../../lib/sheetPresentation'

const source = readFileSync(fileURLToPath(new URL('./DndCharIdentity.vue', import.meta.url)), 'utf8')

describe('character identity summary', () => {
  it('keeps the name visible on the regular summary surface', () => {
    expect(source).toContain("props.block.content?.name_color || 'var(--text-1)'")
  })

  it('renders the stored name, race and classes in the summary', async () => {
    const app = createSSRApp({
      render: () => h(DndCharIdentity, {
        block: { content: { name_id: 'name', race_id: 'race' } },
        values: {
          name: 'Лиссара',
          race: { id: 8, name: 'Эльф' },
          classes: [{ id: 9, name: 'Воин', level: 4 }],
          lvl: { level: 4 },
        },
      }),
    })
    app.provide('charCtx', { ownerMode: true })

    const html = await renderToString(app)
    expect(html).toContain('Лиссара')
    expect(html).toContain('Эльф')
    expect(html).toContain('Воин 4')
  })

  it('keeps identity data in the rendered desktop header layout', async () => {
    const block = sheetBlock(definition, 'char_identity')
    const values = {
      name: 'Лиссара',
      race: { id: 8, name: 'Эльф' },
      classes: [{ id: 9, name: 'Воин', level: 4 }],
      lvl: { level: 4 },
      hp: { current: 24, max: { base: 24 } },
    }
    const app = createSSRApp({ render: () => h(CharacterBlock, { block, values, vars: {} }) })
    app.provide('charCtx', { ownerMode: true })

    const html = await renderToString(app)
    expect(html).toContain('Лиссара')
    expect(html).toContain('Эльф')
    expect(html).toContain('Воин 4')
  })

  it('wraps the class list without splitting an individual class', () => {
    expect(source).toContain('<div class="dci-main-row">')
    expect(source).toContain('<div v-if="classParts.length" class="dci-classes" :title="classPart">')
    expect(source).toMatch(/\.dci-classes \{[^}]*display: flex;[^}]*flex-wrap: wrap;[^}]*max-width: 100%;[^}]*min-width: 0;/)
    expect(source).toMatch(/\.dci-class-item \{[^}]*display: inline-flex;[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*white-space: nowrap;/)
  })

  it('keeps portrait and icon editing out of the identity form', () => {
    expect(source).not.toContain('label="Аватар"')
    expect(source).not.toContain('<AvatarCropModal')
    expect(source).not.toContain('uploadCharacterIcon')
  })
})
