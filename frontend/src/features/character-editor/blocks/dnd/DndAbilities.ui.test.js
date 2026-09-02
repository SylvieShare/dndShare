import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const blockSource = readFileSync(fileURLToPath(new URL('./DndAbilities.vue', import.meta.url)), 'utf8')
const viewSource = readFileSync(fileURLToPath(new URL('./components/DndAbilitiesView.vue', import.meta.url)), 'utf8')

describe('ability rows', () => {
  it('renders contextual passive text under the ability that owns it', () => {
    expect(blockSource).toContain('effect?.source?.valueId === props.block.id')
    expect(blockSource).toContain('...passiveEffectsFor(s)')
    expect(blockSource).toContain('Требования не выполнены')
    expect(viewSource).toContain('v-for="effect in entry.passive_effects || []"')
    expect(viewSource).toContain('<b>{{ effect.title }}</b>')
  })

  it('supports expanded cards with 64px item art and inline descriptions', () => {
    expect(blockSource).toContain(':expanded="!!block.content?.expanded"')
    expect(blockSource).toContain("block.content?.embedded ? 'div' : BaseTile")
    expect(blockSource).toContain('item,')
    expect(viewSource).toContain(':item="entry.item" :size="64"')
    expect(viewSource).toContain('expanded && entry.desc')
    expect(viewSource).toContain('<ResourceRestIcons')
    expect(viewSource).toContain('short_rest: entry.rollback_short_rest, long_rest: entry.rollback_long_rest')
    expect(viewSource).toMatch(/class="abv-title-row"[\s\S]*class="abv-name"[\s\S]*<ResourceRestIcons/)
    expect(viewSource).not.toContain('class="abv-badge')
    expect(viewSource).toContain('.abv--expanded .abv-description {')
    expect(viewSource).toMatch(/\.abv--expanded \.abv-card \{[^}]*grid-template-columns: 64px minmax\(0, 1fr\);/)
    expect(viewSource).toContain('.abv--expanded .abv-card + .abv-card { border-top: 1px solid var(--border); }')
    expect(viewSource).toMatch(/\.abv--expanded \.abv-card \{[^}]*border: 0;/)
    expect(viewSource).toContain('<template v-if="manage" #aside>')
    expect(viewSource).toContain('class="abv-add"')
  })

  it('opens a row action menu without a block edit pencil', () => {
    expect(viewSource).toContain(':show-edit="false"')
    expect(viewSource).toContain('<RowActionMenu')
    expect(viewSource).toContain('>Посмотреть</RowActionItem>')
    expect(viewSource).toContain('entry.usable_resource?.value > 0')
    expect(viewSource).toContain('action="use"')
    expect(viewSource).toContain('action="delete"')
    expect(blockSource).toContain('usable_resource: usableResourceFor(s)')
    expect(blockSource).toContain("type: 'resource_used'")
    expect(blockSource).not.toContain('<MorphEditorShell')
  })

  it('loads handbook items added externally after the ability block mounted', () => {
    expect(blockSource).toContain('async function loadStoredItems()')
    expect(blockSource).toContain("stored.value.map((entry) => String(entry.id)).sort().join(',')")
    expect(blockSource).toContain('if (mounted.value) void loadStoredItems()')
    expect(blockSource).toContain('catalog.value = [...catalog.value, ...added]')
  })
})
