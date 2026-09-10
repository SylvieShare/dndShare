import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import ClassLevelGains from './ClassLevelGains.vue'

const render = props => renderToString(createSSRApp(ClassLevelGains, props))

describe('level hit points and spell-slot gains', () => {
  it('shows maximum hit points on the first level, not a roll or fixed average', async () => {
    const html = await render({ level: 1, hitDie: 'd10', hitPoints: '10 + мод. ТЕЛ' })
    expect(html).toContain('Хиты на старте')
    expect(html).toContain('>10</strong>')
    expect(html).toContain('максимум кости')
    expect(html).not.toContain('или 6')
    expect(html).not.toContain('Изменения ячеек')
  })

  it('shows the die, fixed alternative and modifier beside new slot gains', async () => {
    const html = await render({ level: 3, hitDie: 'd8', hitPoints: '1к8 (или 5) + мод. ТЕЛ', slotChanges: [{ kind: 'added', level: 2, count: 2 }] })
    expect(html).toContain('Прирост хитов')
    expect(html).toContain('или 5')
    expect(html).toContain('ТЕЛ')
    expect(html).toContain('Добавляется 2 яч. 2 круга')
    expect(html).toContain('2 круг')
    expect(html).not.toContain('<button')
  })

  it('keeps pact upgrades visible without an invented HP block', async () => {
    const html = await render({ level: 3, slotChanges: [{ kind: 'upgraded', level: 2, fromLevel: 1, count: 2, pact: true }] })
    expect(html).not.toContain('Прирост хитов')
    expect(html).toContain('1 → 2 круг')
    expect(html).toContain('Магия договора')
    expect(html).toContain('Короткий отдых')
  })
})
