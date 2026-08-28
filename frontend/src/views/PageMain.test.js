import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const pageSource = read('./PageMain.vue')
const heroSource = read('../features/home/components/HomeHero.vue')
const gridSource = read('../features/home/components/HomeFeatureGrid.vue')
const cardSource = read('../features/home/components/HomeFeatureCard.vue')

describe('main page', () => {
  it('presents the four primary product areas as navigable tiles', () => {
    expect(gridSource.match(/key: '/g)).toHaveLength(4)
    for (const route of ['/chars', '/chars/new', '/handbook', '/sessions']) {
      expect(gridSource).toContain(`to: '${route}'`)
    }
    expect(gridSource).toContain('<HomeFeatureCard :feature="feature" />')
  })

  it('uses the approved Lissara artwork as a guide, not the brand mark', () => {
    expect(heroSource).toContain('/static/mascots/lissara-knowing-coin.webp')
    expect(heroSource).toContain('aria-label="Подсказка Лиссары"')
    expect(heroSource).toContain('src="/brand-mark.webp" alt="" aria-hidden="true"')
  })

  it('keeps the page thin and uses the shared tile primitive', () => {
    expect(pageSource).toContain('<HomeHero />')
    expect(pageSource).toContain('<HomeFeatureGrid />')
    expect(cardSource).toContain("import { BaseTile } from '@sylvieshare/share-ui'")
  })
})
