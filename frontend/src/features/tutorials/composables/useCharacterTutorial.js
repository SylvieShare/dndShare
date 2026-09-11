import { computed, nextTick, provide } from 'vue'
import { usePageTutorial } from './usePageTutorial'
import { characterSteps } from '../flows/character'
import { createTutorialActions, tutorialActionsKey, visibleTarget } from '../lib/targets'

export function useCharacterTutorial({ root, mobile, ready, template, sourceVersionId, activeTab, isOwner }) {
  const actions = createTutorialActions()
  provide(tutorialActionsKey, actions)
  const mobileSections = { stats: 0, weapons: 1, spells: 2, inventory: 3, abilities: 4, journal: 6 }
  async function action(name, context) {
    if (mobile.value && name.startsWith('character-section:')) {
      const saved = activeTab.value
      context.onCleanup(() => { activeTab.value = saved })
      activeTab.value = mobileSections[name.split(':')[1]]
      await nextTick()
    } else if (name === 'character-section:stats') {
      // Characteristics are always present in the desktop sheet.
    } else await actions.run(name, context)
  }
  return usePageTutorial({
    flowId: computed(() => 'character'),
    sourceKey: computed(() => sourceVersionId.value ? `edition:${sourceVersionId.value}` : null),
    mobile, ready: computed(() => ready.value && isOwner.value),
    createSteps: () => characterSteps({ mobile: mobile.value, dnd: template.value?.system === 'dnd5e',
      target: name => visibleTarget(name === 'character-hp-editor' ? document : root.value, name), action }),
  })
}
