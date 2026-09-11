import { computed, onBeforeUnmount, provide, reactive, ref, watch } from 'vue'
import { useGuidedTour } from '@sylvieshare/share-ui'
import { useRoute } from 'vue-router'
import { useTutorialsStore } from '@/stores/tutorials'
import { useAccountStore } from '@/stores/account'
import { TUTORIAL_REVISION, tutorialKey } from '../lib/tutorialIdentity'

export const pageTutorialKey = Symbol('page-tutorial')

export function usePageTutorial({ flowId, sourceKey, mobile, ready, createSteps }) {
  const store = useTutorialsStore()
  const account = useAccountStore()
  const route = useRoute()
  const owner = Symbol('tutorial-owner')
  const loadError = ref('')
  const context = computed(() => ({ flowId: flowId.value, sourceKey: sourceKey.value,
    device: mobile.value ? 'mobile' : 'desktop', revision: TUTORIAL_REVISION }))
  let runContext = null
  let disposed = false
  let generation = 0
  let lastAttempt = ''
  const tour = reactive(useGuidedTour({
    onFinish: status => store.save(runContext, status),
  }))

  async function start(force = false) {
    const request = ++generation
    loadError.value = ''
    if (!ready.value || !context.value.sourceKey) return
    try {
      if (!await store.ensure() || disposed || request !== generation) return
      if (!force && store.seen(context.value)) return
      if (store.activeOwner && store.activeOwner !== owner) return
      store.activeOwner = owner
      runContext = { ...context.value }
      await tour.start(createSteps())
    } catch {
      if (disposed || request !== generation) return
      loadError.value = 'Не удалось загрузить обучение. Попробуйте снова.'
    }
  }
  function cancel() {
    generation += 1
    tour.stop()
    if (store.activeOwner === owner) store.activeOwner = null
  }
  watch(() => tour.active, active => {
    if (!active && store.activeOwner === owner) store.activeOwner = null
  })
  watch([ready, context, () => account.user?.id], () => {
    const key = `${account.user?.id}:${tutorialKey(context.value)}`
    if (!ready.value || !context.value.sourceKey) { cancel(); return }
    if (key === lastAttempt) return
    cancel()
    lastAttempt = key
    void start()
  }, { immediate: true })
  // Query changes are allowed: steps switch sections. A page/UUID change cancels.
  watch(() => route.path, cancel)
  onBeforeUnmount(() => { disposed = true; cancel() })
  const controls = { restart: () => start(true), tour, loadError }
  provide(pageTutorialKey, controls)
  return controls
}
