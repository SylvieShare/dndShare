import { describe, expect, it } from 'vitest'
import { AUTOMATION_STATUSES, automationStatus, itemAutomationDraft } from './itemAutomation'

describe('catalogue automation metadata', () => {
  it('does not infer coverage from item mechanics', () => {
    expect(itemAutomationDraft({ data: { weapon_damage: [{}], feature_actions: [{}] } })).toEqual({ automationStatus: 'unreviewed', automationNote: '', requiresPlayerInteraction: false })
    expect(automationStatus('future-value').value).toBe('unreviewed')
  })
  it('keeps player interaction independent from every coverage status', () => {
    for (const { value } of AUTOMATION_STATUSES) {
      const item = { automationStatus: value, automationNote: 'Комментарий', requiresPlayerInteraction: true }
      expect(itemAutomationDraft(item)).toEqual(item)
      expect(itemAutomationDraft({ ...item, requiresPlayerInteraction: false }).requiresPlayerInteraction).toBe(false)
    }
  })
})
