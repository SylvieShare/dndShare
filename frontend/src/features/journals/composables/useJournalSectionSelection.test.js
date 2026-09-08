import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { useJournalSectionSelection } from './useJournalSectionSelection'
const root = (uuid, ids) => ({ uuid, sections: ids.map(id => ({ id, events: [] })) })
describe('journal section selection', () => {
  it('starts at the newest chapter and retains selection during refresh and source changes', () => {
    const scope = effectScope()
    scope.run(() => {
      const journal = ref(null)
      const selection = useJournalSectionSelection(journal)
      journal.value = root('personal', ['1', '2'])
      expect(selection.selectedId.value).toBe('2')
      selection.selectedId.value = '1'
      journal.value = root('personal', ['1', '2', '3'])
      expect(selection.selectedId.value).toBe('1')
      journal.value = root('session', ['10', '11'])
      expect(selection.selectedId.value).toBe('11')
      journal.value = root('personal', ['1', '2', '3'])
      expect(selection.selectedId.value).toBe('1')
      journal.value = root('personal', ['2', '3'])
      expect(selection.selectedId.value).toBe('3')
      journal.value = root('personal', [])
      expect(selection.selectedSection.value).toBeNull()
    })
    scope.stop()
  })
})
