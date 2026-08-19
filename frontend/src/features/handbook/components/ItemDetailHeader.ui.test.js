import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')
const headerSource = read('ItemDetailHeader.vue')
const detailSource = read('HandbookItemDetail.vue')
const enemySummarySource = read('../../items/detail-components/EnemyDetailSummary.vue')
const enemySummaryStyles = read('../../items/detail-components/styles/EnemyDetailSummary.css')
const enemyContentSource = read('../../items/detail-components/EnemyDetailContent.vue')

describe('handbook item detail cover', () => {
  it('uses the intrinsic cover ratio without a shared maximum height', () => {
    expect(headerSource).toContain('aspect-ratio: var(--cover-aspect-ratio, 4 / 1);')
    expect(headerSource).not.toContain('max-height: min(320px, 42dvh);')
    expect(headerSource).not.toContain("'--cover-max-height'")
    expect(headerSource).toContain('flex: 0 0 auto;')
  })

  it('keeps cover art centered without height-limit layout tracking', () => {
    expect(headerSource).toContain('object-position: center;')
    expect(headerSource).not.toContain('coverHeightLimited')
    expect(headerSource).not.toContain('ResizeObserver')
    expect(headerSource).not.toContain('object-position: center top;')
  })

  it('supports a separate cover height profile for each handbook type', () => {
    expect(headerSource).toContain('const TYPE_COVER_STYLES = {')
    expect(headerSource).toContain("'--cover-min-height': '440px'")
    expect(headerSource).toContain('TYPE_COVER_STYLES[props.type?.id]')
    expect(headerSource).toContain('.item-detail-header-covered.item-detail-header-summary {\n  aspect-ratio: var(--cover-aspect-ratio, 4 / 3);')
  })

  it('keeps bestiary data in local translucent blocks without shading the whole cover', () => {
    expect(detailSource).toContain('<EnemyDetailSummary :item="item" :type="type" />')
    expect(detailSource).toContain('<template v-if="isEnemy" #summary>')
    expect(headerSource).toContain('<slot name="summary" />')
    expect(headerSource).toContain('.item-detail-header-covered.item-detail-header-summary .item-detail-shade')
    expect(headerSource).toContain('display: none;')
    expect(headerSource).toContain('.item-detail-header-covered.item-detail-header-summary .item-detail-title')
    expect(headerSource).toContain('width: fit-content;')
    expect(headerSource).not.toContain('.item-detail-header-covered.item-detail-header-summary .item-detail-overlay {')
    expect(enemySummarySource).toContain('class="enemy-abilities"')
    expect(enemyContentSource).not.toContain('class="enemy-abilities"')
    expect(enemyContentSource).not.toContain('class="enemy-top"')
  })

  it('frames a centered creature with side stats and bottom abilities', () => {
    expect(enemySummarySource).toContain('class="enemy-stats-side enemy-stats-left"')
    expect(enemySummarySource).toContain('class="enemy-cover-safe-zone"')
    expect(enemySummarySource).toContain('class="enemy-stats-side enemy-stats-right"')
    expect(enemySummaryStyles).toContain('"left center right"')
    expect(enemySummaryStyles).toContain('"abilities abilities abilities"')
    expect(enemySummaryStyles).toContain('grid-template-rows: minmax(min-content, 1fr) auto;')
    expect(headerSource).toContain('.item-detail-header-summary .item-detail-summary {\n  flex: 1;')
    expect(enemySummaryStyles).toContain('min-height: 190px;')
    expect(enemySummaryStyles).toContain('"left right"')
    expect(enemySummaryStyles).toContain('"abilities abilities"')
  })

  it('uses the icon only as a missing-cover fallback and moves the id below the content', () => {
    expect(headerSource).toContain('v-if="!hasCover && (item.iconImageUrl || item.svg)"')
    expect(headerSource).not.toContain('class="item-detail-id"')
    expect(detailSource).toContain('v-if="showTitle" class="detail-technical-meta"')
    expect(detailSource).toContain('<span>ID {{ item.id }}</span>')
    expect(detailSource).toContain('margin-top: auto;')
  })

  it('keeps overflowing detail content scrollable on every viewport', () => {
    expect(detailSource).toContain('min-height: 0;')
    expect(detailSource).toContain('overflow-y: auto;')
    expect(detailSource).toContain('overscroll-behavior-y: contain;')
    expect(detailSource).not.toContain('overflow: visible;')
  })
})
