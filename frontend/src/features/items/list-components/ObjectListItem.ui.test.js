import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')
const objectSource = read('ObjectListItem.vue')
const listSource = read('../../handbook/components/HandbookItemList.vue')
const wrappers = [
  'EnemyListItem.vue',
  'FeatListItem.vue',
  'ItemListItem.vue',
  'PotionListItem.vue',
  'SpellListItem.vue',
  'WeaponListItem.vue',
].map(read)

describe('handbook object list tile', () => {
  it('adapts domain identity and optional slots to the shared row', () => {
    expect(objectSource).toContain('<ContentRow :title="item.name"')
    for (const slot of ['metric', 'subtitle', 'name-extras', 'trailing']) expect(objectSource).toContain(`name="${slot}"`)
    expect(objectSource).toContain('props.type?.iconImageUrl')
    expect(objectSource).toContain('? 64 : 22')
    expect(objectSource).toContain('<slot v-else name="icon-fallback" />')
    expect(objectSource).not.toContain('<style')
  })

  it('keeps every rich item renderer on the shared abstraction', () => {
    for (const source of wrappers) {
      expect(source).toContain('<ObjectListItem')
      expect(source).not.toContain("import ItemIcon from")
    }
    expect(read('SpellListItem.vue')).toContain('<template #metric>')
    expect(read('EnemyListItem.vue')).toContain('#metric>')
    expect(read('PotionListItem.vue')).toContain('<template #icon-fallback>')
    expect(read('FeatListItem.vue')).toContain('<template #icon-fallback>')
    expect(listSource).toContain('<HandbookListItem')
    expect(read('HandbookListItem.vue')).toContain('|| ObjectListItem')
    expect(listSource).not.toContain('hasRichRenderer')
  })

  it('puts selection and activation on the shared row without another tile wrapper', () => {
    expect(objectSource).toContain(':interactive="interactive" :selected="selected"')
    expect(listSource).toContain('class="list-row"')
    expect(listSource).not.toContain('<div class="list-row"')
    expect(listSource).not.toContain('list-row-spell')
  })
})
