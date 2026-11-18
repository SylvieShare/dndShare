import { shallowRef } from 'vue'
import { fetchGet } from '@/shared/api/http'

export function useRedCreationArt() {
  const dictionaryTypes = shallowRef([])
  const collectionTypes = shallowRef([])
  const methods = shallowRef([])

  async function loadDictionaries(sourceId) {
    const response = await fetchGet(`/suggest/types?sourceId=${sourceId}`)
    dictionaryTypes.value = response.items || []
    const type = dictionaryTypes.value.find(row => row.name === 'Методы создания')
    if (type) methods.value = (await fetchGet(`/suggest/${type.id}`)).items || []
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
    methodCover: key => methods.value.find(row => row.code === key)?.coverImageUrl || dictionaryCover('Методы создания'),
  }
}
