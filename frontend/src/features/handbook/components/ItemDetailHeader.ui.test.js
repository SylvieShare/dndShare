import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')
const headerSource = read('ItemDetailHeader.vue')
const detailSource = read('HandbookItemDetail.vue')

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

  it('keeps overflowing detail content scrollable on every viewport', () => {
    expect(detailSource).toContain('min-height: 0;')
    expect(detailSource).toContain('overflow-y: auto;')
    expect(detailSource).toContain('overscroll-behavior-y: contain;')
    expect(detailSource).not.toContain('overflow: visible;')
  })
})
