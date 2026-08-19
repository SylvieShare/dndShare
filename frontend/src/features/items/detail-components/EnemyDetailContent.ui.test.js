import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const enemySource = readFileSync(fileURLToPath(new URL('./EnemyDetailContent.vue', import.meta.url)), 'utf8')
const enemyStyles = readFileSync(fileURLToPath(new URL('./styles/EnemyDetailContent.css', import.meta.url)), 'utf8')
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
    expect(enemySource).toContain('class="enemy-blocks enemy-blocks--actions"')
    expect(enemyStyles).toContain('font-family: var(--font-ui);')
    expect(enemyStyles).toContain('font-size: 16px;')
    expect(enemyStyles).toContain('font-weight: 700;')
    expect(enemyStyles).toContain('.block-name::before')
    expect(enemyStyles).toContain('.enemy-blocks--actions .block-name::before')
  })
})
