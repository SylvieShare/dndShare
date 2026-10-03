import { computed, watch } from 'vue'
import { gameContextPresentation } from '@/shared/lib/gameContextPresentation'

export function useHandbookTitle({ route, selectedType, selectedItem, sourceVersionId, gameContext }) {
  const pageRouteName = route.name
  const title = computed(() => {
    const name = selectedItem.value?.name || selectedType.value?.name || 'Справочник'
    const source = selectedType.value
      ? gameContext.sources.find(source => Number(source.id) === Number(selectedType.value.sourceId))
      : gameContext.selectedSource
    const version = selectedType.value
      ? source?.versions?.find(version => Number(version.id) === Number(sourceVersionId.value))
      : gameContext.selectedVersion
    if (!source) return name
    const context = gameContextPresentation(source, version)
    return [name, context.name, context.edition].filter(Boolean).join(' · ')
  })

  watch(title, value => {
    if (route.name === pageRouteName) document.title = value
  }, { immediate: true })

  return title
}
