import { computed, nextTick, provide } from 'vue'
import { useIsMobile } from '@sylvieshare/share-ui'
import { usePageTutorial } from './usePageTutorial'
import { sessionSteps } from '../flows/session'
import { createTutorialActions, tutorialActionsKey, visibleTarget } from '../lib/targets'

export function useSessionTutorial({ root, session, isDm, ready, primaryView }) {
  // Matches the session toolbar's responsive layout.
  const mobile = useIsMobile(760)
  const actions = createTutorialActions()
  provide(tutorialActionsKey, actions)
  const tutorial = usePageTutorial({
    flowId: computed(() => isDm.value ? 'session-dm' : 'session-player'),
    sourceKey: computed(() => session.value ? (session.value.systemId ? `source:${session.value.systemId}` : 'unassigned') : null),
    mobile, ready,
    createSteps: () => sessionSteps({ mobile: mobile.value, dm: isDm.value,
      target: name => visibleTarget(name === 'session-settings' ? document : root.value, name),
      action: actions.run,
      async showView(view, context) {
        const saved = primaryView.value
        context.onCleanup(() => { primaryView.value = saved })
        primaryView.value = view
        await nextTick()
      },
    }),
  })
  return { tutorial, mobile }
}
