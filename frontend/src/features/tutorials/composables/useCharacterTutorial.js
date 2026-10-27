import { computed, nextTick, provide } from 'vue'
import { usePageTutorial } from './usePageTutorial'
import { characterSteps } from '../flows/character'
import { createTutorialActions, tutorialActionsKey, visibleTarget } from '../lib/targets'

export function useCharacterTutorial({ root, mobile, ready, template, sourceVersionId, activeTab, activeTabs, format, isOwner }) {
  const actions = createTutorialActions()
  provide(tutorialActionsKey, actions)
  async function action(name, context) {
    if (name.startsWith('character-section:')) {
      const index = activeTabs.value.findIndex(tab => tab.id === name.split(':')[1])
      if (index < 0) return
      const saved = activeTabs.value[activeTab.value]?.id
      context.onCleanup(() => {
        activeTab.value = Math.max(0, activeTabs.value.findIndex(tab => tab.id === saved))
      })
      activeTab.value = index
      await nextTick()
    } else {
      if (format.value === 'tablet' && ['character-health', 'character-menu'].includes(name)) {
        await action('character-section:base', context)
      }
      await actions.run(name, context)
    }
  }
  return usePageTutorial({
    flowId: computed(() => 'character'),
    sourceKey: computed(() => sourceVersionId.value ? `edition:${sourceVersionId.value}` : null),
    mobile, layout: format, ready: computed(() => ready.value && isOwner.value),
    createSteps: () => characterSteps({ mobile: mobile.value, tablet: format.value === 'tablet', dnd: template.value?.system === 'dnd5e',
      target: name => visibleTarget(['character-hp-editor', 'character-menu'].includes(name) ? document : root.value, name), action }),
  })
}
