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
  it('owns the common icon, metric, identity and trailing layout', () => {
    const icon = objectSource.indexOf('class="oli-icon"')
    const metric = objectSource.indexOf('class="oli-metric"')
    const identity = objectSource.indexOf('class="oli-main"')
    const trailing = objectSource.indexOf('class="oli-right"')

    expect(icon).toBeGreaterThan(-1)
    expect(metric).toBeGreaterThan(icon)
    expect(identity).toBeGreaterThan(metric)
    expect(trailing).toBeGreaterThan(identity)
    expect(objectSource).toContain('props.type?.iconImageUrl')
    expect(objectSource).toContain('? 64 : 22')
    expect(objectSource).toContain('<slot v-else name="icon-fallback" />')
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
    expect(listSource).toContain('<ObjectListItem')
    expect(listSource).toContain('v-else')
    expect(listSource).not.toContain('hasRichRenderer')
  })

  it('pins the shared 64 px icon well to the left edge of every rich tile', () => {
    expect(objectSource).toContain('flex: 0 0 64px')
    expect(listSource).toContain('min-height: 66px')
    expect(listSource).toContain('padding: 0 12px 0 0')
    expect(listSource).toContain('overflow: hidden')
    expect(listSource).not.toContain('list-row-spell')
  })
})
