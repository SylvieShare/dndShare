import { shallowRef } from 'vue'
import { fetchGet } from '@/shared/api/http'

export function useRedCreationArt() {
  const dictionaryTypes = shallowRef([])
  const collectionTypes = shallowRef([])
  const methods = shallowRef([])
  const stats = shallowRef(new Map())

  async function loadDictionaries(sourceId) {
    const response = await fetchGet(`/suggest/types?sourceId=${sourceId}`)
    dictionaryTypes.value = response.items || []
    await Promise.allSettled([
      loadDictionary('Методы создания', rows => { methods.value = rows }),
      loadDictionary('Характеристики', rows => {
        stats.value = new Map(rows.map(row => [row.code, row]))
      }),
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
    stat: key => stats.value.get(key),
    methodCover: key => methods.value.find(row => row.code === key)?.coverImageUrl || dictionaryCover('Методы создания'),
  }
}
