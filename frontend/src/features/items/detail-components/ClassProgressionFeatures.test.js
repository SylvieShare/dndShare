import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import ClassProgressionFeatures from './ClassProgressionFeatures.vue'
import { progressionFeatureRows } from '@/features/items/lib/progressionFeatureRows'

const ability = { id: 1, typeId: 4, name: 'Вдохновение барда', iconImageUrl: '/bard.webp' }

describe('progression ability rows', () => {
  it('merges multiple improvements into one existing-ability row', () => {
    expect(progressionFeatureRows([], [
      { item: ability, text: '1к8' }, { item: ability, text: '2 использ.' }, { item: ability, text: '1к8' },
    ])).toEqual([{ item: ability, upgraded: true, changes: ['1к8', '2 использ.'] }])
    expect(progressionFeatureRows([ability], [{ item: ability, text: '1к6' }])[0].upgraded).toBe(false)
  })

  it('renders upgrades inside a single clickable standard list row', async () => {
    const html = await renderToString(createSSRApp(ClassProgressionFeatures, { improvements: [{ item: ability, text: '1к8' }] }))
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('oli-name')
    expect(html).toContain('src="/bard.webp"')
    expect(html).toContain('Усиление')
    expect(html).toContain('1к8')
    expect(html).not.toContain('Новая способность')
  })
})
