import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import GameContextSelector from './GameContextSelector.vue'
import { useGameContextStore } from '@/stores/gameContext'
import { gameContextOptions } from '@/shared/lib/gameContextPresentation'

// The sidebar trigger can render on the server; the floating layer needs a browser.
vi.mock('@sylvieshare/share-ui', async importOriginal => ({
  ...await importOriginal(),
  BasePopover: { render: () => null },
}))

const sources = [
  { id: 1, name: 'DND5e', versions: [{ id: 11, version: '2014' }, { id: 12, version: '2024' }] },
  { id: 2, name: 'Vampire: TM', versions: [{ id: 22, version: 'V20' }] },
]

async function renderSelection(sourceVersionId, compact = false) {
  const pinia = createPinia()
  const store = useGameContextStore(pinia)
  store.$patch({ sources, sourceVersionId, ready: true })
  return renderToString(createSSRApp(GameContextSelector, { compact }).use(pinia))
}

describe('game context selector', () => {
  it('offers every system and edition as a complete choice, preserving its API identity', () => {
    expect(gameContextOptions([...sources, { id: 3, name: 'Empty' }])).toEqual([
      { id: 11, name: 'D&D 5e', edition: '2014', emblem: 'dnd' },
      { id: 12, name: 'D&D 5e', edition: '2024', emblem: 'dnd' },
      { id: 22, name: 'Vampire', edition: 'V20', emblem: 'vampire' },
    ])
  })

  it('keeps unfamiliar systems and editions selectable under their actual names', () => {
    const options = gameContextOptions([{ id: 9, name: 'Another system', versions: [{ id: 91, version: 'Second' }] }])
    expect(options[0]).toMatchObject({ id: 91, name: 'Another system', edition: 'Second' })
  })

  it('shows the selected edition in the sidebar with an accessible menu trigger', async () => {
    const html = await renderSelection(12)
    expect(html).toContain('aria-label="Игровая система: D&amp;D 5e · 2024"')
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('game-context-emblem--dnd')
  })

  it('keeps the edition accessible when the sidebar shows the shared system logo', async () => {
    const classic = await renderSelection(11, true)
    const revised = await renderSelection(12, true)
    const vampire = await renderSelection(22, true)
    expect(classic).toContain('game-context-emblem--dnd')
    expect(revised).toContain('game-context-emblem--dnd')
    expect(classic).toContain('aria-label="Игровая система: D&amp;D 5e · 2014"')
    expect(revised).toContain('aria-label="Игровая система: D&amp;D 5e · 2024"')
    expect(vampire).toContain('game-context-emblem--vampire')
    expect(vampire).toContain('aria-label="Игровая система: Vampire · V20"')
    expect(classic).not.toContain('class="game-context-trigger-current"')
  })
})
