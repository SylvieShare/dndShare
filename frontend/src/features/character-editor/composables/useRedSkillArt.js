import { computed, shallowRef } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { useGameContextStore } from '@/stores/gameContext'
import { useSuggestStore } from '@/stores/suggest'

export function useRedSkillArt() {
  const types = shallowRef({})
  const context = useGameContextStore()
  const suggests = useSuggestStore()
  const byCode = typeId => new Map(suggests.items(typeId)
    .filter(row => !row.userId && row.code)
    .map(row => [row.code, row]))
  const stats = computed(() => byCode(types.value.stat))
  const skills = computed(() => byCode(types.value.skill))

  function load(dictionaries) {
    types.value = {
      stat: dictionaries.find(row => row.name === 'Характеристики')?.id,
      skill: dictionaries.find(row => row.name === 'Навыки')?.id,
    }
    return Promise.allSettled(Object.values(types.value).map(id => suggests.ensure(id)))
  }

  async function loadFromSystem() {
    await context.ensure()
    const source = context.sources.find(row => row.name === 'Cyberpunk')
    if (!source) return
    const response = await fetchGet(`/suggest/types?sourceId=${source.id}`)
    return load(response.items || [])
  }

  return {
    load,
    loadFromSystem,
    stat: key => stats.value.get(key),
    skill: key => skills.value.get(key),
  }
}
