import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./HandbookItemList.vue', import.meta.url)), 'utf8')
const handbookPage = readFileSync(fileURLToPath(new URL('../pages/ViewHandbook.vue', import.meta.url)), 'utf8')
const controls = readFileSync(fileURLToPath(new URL('./HandbookCollectionBar.vue', import.meta.url)), 'utf8')
const armorList = readFileSync(fileURLToPath(new URL('../../items/list-components/ArmorListItem.vue', import.meta.url)), 'utf8')
const weaponList = readFileSync(fileURLToPath(new URL('../../items/list-components/WeaponListItem.vue', import.meta.url)), 'utf8')

describe('handbook list controls', () => {
  it('owns search and filters above the scrollable rows', () => {
    const controlsAt = source.indexOf('<HandbookCollectionBar')
    const rowsAt = source.indexOf('<div class="list-body"')

    expect(controlsAt).toBeGreaterThan(0)
    expect(rowsAt).toBeGreaterThan(controlsAt)
    expect(source).toContain(':show-identity="false"')
    expect(source).toContain('@update:search="$emit(\'update:search\', $event)"')
    expect(source).toContain('@update:content-source-ids="$emit(\'update:content-source-ids\', $event)"')
    expect(source).toContain('.list-collection-controls {\n  flex: 0 0 auto;')
    expect(controls).toContain('<span class="col-filter-label">Фильтры</span>')
    expect(controls).toContain('<span class="col-filter-label">Источники</span>')
    expect(controls).toContain("'Поиск по названию — RU / EN...'")
    expect(controls).toContain('v-if="hasChoiceOptions(field)"')
    expect(controls).toContain('hasFilterValues(f) || hasItemFilterOptions(f)')
    expect(controls).toContain('v-for="group in contentSourceGroups"')
    expect(controls).toContain('groupContentSources(props.contentSources)')
  })

  it('uses the shared rich row for armor with AC, material class and price', () => {
    expect(source.match(/<ArmorListItem v-else-if="type.id === 12"/g)).toHaveLength(2)
    expect(armorList).toContain('<ObjectListItem')
    expect(armorList).toContain('#metric')
    expect(armorList).toContain('armor-list-cost')
    expect(armorList).toContain('Помеха Скрытности')
  })

  it('places weapon damage in the shared metric column and price at the trailing edge', () => {
    expect(weaponList).toContain('#metric')
    expect(weaponList).toContain('#trailing')
    expect(weaponList).toContain('wli-cost')
  })

  it('keeps the wide collection bar identity-only on the handbook page', () => {
    expect(handbookPage).toContain(':show-controls="false"')
    expect(handbookPage).toContain('<HandbookItemList')
    expect(handbookPage).toContain('show-controls')
    expect(handbookPage).toContain(':content-sources="contentSources"')
  })

  it('keeps only the requested left side frame on the grouping toolbar', () => {
    const toolbar = source.match(/\.list-group-toolbar\s*\{([^}]*)\}/)?.[1] || ''

    expect(toolbar).toContain('border-left: 1px solid var(--border);')
    expect(toolbar).not.toContain('border-right:')
  })
})
