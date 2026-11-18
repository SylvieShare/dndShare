import { shallowRef } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { useRedSkillArt } from '@/features/character-editor/composables/useRedSkillArt'

export function useRedCreationArt() {
  const dictionaryTypes = shallowRef([])
  const collectionTypes = shallowRef([])
  const methods = shallowRef([])
  const skillArt = useRedSkillArt()

  async function loadDictionaries(sourceId) {
    const response = await fetchGet(`/suggest/types?sourceId=${sourceId}`)
    dictionaryTypes.value = response.items || []
    await Promise.allSettled([
      loadDictionary('Методы создания', rows => { methods.value = rows }),
      skillArt.load(dictionaryTypes.value),
    ])
  }

  async function loadDictionary(name, assign) {
    const type = dictionaryTypes.value.find(row => row.name === name)
    if (!type) return
    const response = await fetchGet(`/suggest/${type.id}`)
    assign((response.items || []).filter(row => !row.userId))
  }

  async function loadCollections(sourceId) {
    const response = await fetchGet(`/item-types?sourceId=${sourceId}`)
    collectionTypes.value = response.types || []
  }

  const dictionaryCover = name => dictionaryTypes.value.find(row => row.name === name)?.coverImageUrl
  const collectionCover = name => collectionTypes.value.find(row => row.name === name)?.coverImageUrl

  return {
    load: sourceId => Promise.allSettled([loadDictionaries(sourceId), loadCollections(sourceId)]),
    dictionaryCover,
    collectionCover,
    stat: skillArt.stat,
    skill: skillArt.skill,
    methodCover: key => methods.value.find(row => row.code === key)?.coverImageUrl || dictionaryCover('Методы создания'),
  }
}
