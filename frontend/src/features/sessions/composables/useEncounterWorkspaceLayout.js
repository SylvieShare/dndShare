import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { spacingTokens } from '@/app/design-tokens'
import { encounterPreviewFits, encounterPrimaryWidth } from '../lib/encounterLayout'

export function useEncounterWorkspaceLayout(root, toolbar, workspace) {
  const hasPreviewSpace = ref(false), compactRoster = ref(true)
  let observer
  const toolbarElement = () => toolbar.value?.$el || toolbar.value
  function measure() {
    const element = root.value, header = toolbarElement()
    if (!element) return
    const gutter = workspace() ? spacingTokens.page : 0
    const available = element.clientWidth - 2 * gutter
    hasPreviewSpace.value = encounterPreviewFits(available)
    compactRoster.value = available < encounterPrimaryWidth
    if (workspace() && header) element.style.setProperty('--session-workspace-content-top', `${header.offsetHeight + spacingTokens.large}px`)
  }
  function observe() {
    observer?.disconnect()
    for (const element of [root.value, toolbarElement()]) if (element) observer.observe(element)
    measure()
  }
  onMounted(() => { observer = new ResizeObserver(measure); observe() })
  watch([root, toolbar, workspace], () => { if (observer) observe() }, { flush: 'post' })
  onBeforeUnmount(() => observer?.disconnect())
  return { hasPreviewSpace, compactRoster }
}
