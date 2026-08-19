import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const enemySource = readFileSync(fileURLToPath(new URL('./EnemyDetailContent.vue', import.meta.url)), 'utf8')
const entrySource = readFileSync(fileURLToPath(new URL('../../../shared/ui/DetailEntryCard.vue', import.meta.url)), 'utf8')
const sectionSource = readFileSync(fileURLToPath(new URL('../../../shared/ui/DetailSection.vue', import.meta.url)), 'utf8')

describe('enemy detail section hierarchy', () => {
  it('gives bestiary sections semantic icons and a stronger combat accent', () => {
    for (const icon of ['MapPin', 'Sparkles', 'Swords', 'Shield', 'BookOpen', 'Tags']) {
      expect(enemySource).toContain(`<template #icon><${icon} /></template>`)
    }
    expect(enemySource).toContain('label="Действия" tone="combat"')
  })

  it('renders illustrated headings with a framed icon and fading rule', () => {
    expect(sectionSource).toContain("'detail-section--illustrated': $slots.icon")
    expect(sectionSource).toContain('class="detail-section-icon"')
    expect(sectionSource).toContain('class="detail-section-rule"')
    expect(sectionSource).toContain('.detail-section--combat .detail-section-icon')
    expect(sectionSource).toContain('linear-gradient(90deg,')
  })

  it('separates action names from prose with stronger type and a combat marker', () => {
    expect(enemySource).toContain('<DetailEntryCard v-for="b in item.data.actions"')
    expect(enemySource).toContain(':title="b.name" tone="combat"')
    expect(entrySource).toContain('font-family: var(--font-ui);')
    expect(entrySource).toContain('font-size: 16px;')
    expect(entrySource).toContain('font-weight: 700;')
    expect(entrySource).toContain('.detail-entry-card-title::before')
    expect(entrySource).toContain('.detail-entry-card--combat .detail-entry-card-title::before')
    expect(entrySource).toContain('color: color-mix(in srgb, var(--text-2) 88%, var(--text-muted));')
  })
})
