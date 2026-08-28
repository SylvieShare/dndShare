import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  screencastPreparation,
  screencastSteps,
  screencastTotalSeconds,
} from '@/features/admin/data/screencastGuide'

const pageSource = readFileSync(fileURLToPath(new URL('./ViewScreencastGuide.vue', import.meta.url)), 'utf8')
const routerSource = readFileSync(fileURLToPath(new URL('../../../app/router.js', import.meta.url)), 'utf8')

describe('standalone screencast guide', () => {
  it('fits the requested three-to-five-minute window and keeps every row synchronized', () => {
    expect(screencastTotalSeconds).toBeGreaterThanOrEqual(180)
    expect(screencastTotalSeconds).toBeLessThanOrEqual(300)
    expect(screencastSteps.length).toBeGreaterThanOrEqual(8)
    for (const step of screencastSteps) {
      expect(step.action.length).toBeGreaterThan(0)
      expect(step.speech.length).toBeGreaterThan(0)
      expect(step.criteria.length).toBeGreaterThan(0)
    }
  })

  it('covers preparation, mobile readability and presenter progress', () => {
    expect(screencastPreparation.length).toBeGreaterThanOrEqual(5)
    expect(pageSource).toContain('Что делать на сайте')
    expect(pageSource).toContain('Что говорить')
    expect(pageSource).toContain('wakeLock')
    expect(pageSource).toContain('@media (max-width: 640px)')
    expect(pageSource).toContain('localStorage')
  })

  it('uses a clean standalone route', () => {
    expect(routerSource).toContain("path: '/screencast-guide'")
    expect(routerSource).toContain("name: 'ScreencastGuide'")
    expect(routerSource).toContain('standaloneView: true')
  })
})
