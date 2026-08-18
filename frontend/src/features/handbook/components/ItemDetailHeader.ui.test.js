import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')
const headerSource = read('ItemDetailHeader.vue')
const detailSource = read('HandbookItemDetail.vue')
const enemySummarySource = read('../../items/detail-components/EnemyDetailSummary.vue')
const enemyContentSource = read('../../items/detail-components/EnemyDetailContent.vue')

describe('handbook item detail cover', () => {
  it('caps legacy artwork without letting the header consume the viewport', () => {
    expect(headerSource).toContain('aspect-ratio: var(--cover-aspect-ratio, 4 / 1);')
    expect(headerSource).toContain('max-height: min(320px, 42dvh);')
    expect(headerSource).toContain('flex: 0 0 auto;')
  })

  it('lets height-limited artwork continue downward behind a dark content strip', () => {
    expect(headerSource).toContain("'item-detail-header-tall-cover': coverHeightLimited")
    expect(headerSource).toContain('intrinsicHeight > header.clientHeight + 1')
    expect(headerSource).toContain('object-position: center top;')
    expect(headerSource).toContain('background: color-mix(in srgb, var(--scrim) 62%, transparent);')
  })

  it('supports a separate cover height profile for each handbook type', () => {
    expect(headerSource).toContain('const TYPE_COVER_STYLES = {')
    expect(headerSource).toContain("'--cover-min-height': '440px'")
    expect(headerSource).toContain("'--cover-max-height': 'none'")
    expect(headerSource).toContain('TYPE_COVER_STYLES[props.type?.id]')
  })

  it('places the bestiary identity and combat summary on the translucent cover overlay', () => {
    expect(detailSource).toContain('<EnemyDetailSummary :item="item" :type="type" />')
    expect(detailSource).toContain('<template v-if="isEnemy" #summary>')
    expect(headerSource).toContain('<slot name="summary" />')
    expect(headerSource).toContain('.item-detail-header-covered.item-detail-header-summary .item-detail-overlay')
    expect(headerSource).toContain('backdrop-filter: blur(1.5px);')
    expect(enemySummarySource).toContain('class="enemy-abilities"')
    expect(enemyContentSource).not.toContain('class="enemy-abilities"')
    expect(enemyContentSource).not.toContain('class="enemy-top"')
  })

  it('keeps overflowing detail content scrollable on every viewport', () => {
    expect(detailSource).toContain('min-height: 0;')
    expect(detailSource).toContain('overflow-y: auto;')
    expect(detailSource).toContain('overscroll-behavior-y: contain;')
    expect(detailSource).not.toContain('overflow: visible;')
  })
})
