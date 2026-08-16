import { computed, ref } from 'vue'
import {
  createSessionLocation,
  createSessionNpc,
	createSessionQuest,
  deleteSessionLocation,
  deleteSessionNpc,
	deleteSessionQuest,
  getSessionWorld,
  moveSessionLocation,
  updateSessionLocation,
  updateSessionNpc,
	updateSessionQuest,
} from '@/shared/api/sessionsApi'

const EMPTY_WORLD = Object.freeze({ locations: [], npcs: [], quests: [], scenes: [] })

export function useSessionWorld(sessionUuid) {
  const world = ref(EMPTY_WORLD)
  const loading = ref(false)
  const loaded = ref(false)
  const saving = ref(false)
  const error = ref('')
  let loadPromise = null

  const locations = computed(() => world.value.locations || [])
  const npcs = computed(() => world.value.npcs || [])
	const quests = computed(() => world.value.quests || [])
  const scenes = computed(() => world.value.scenes || [])
  const locationsById = computed(() => new Map(locations.value.map(location => [location.id, location])))
  const npcsById = computed(() => new Map(npcs.value.map(npc => [npc.id, npc])))
	const questsById = computed(() => new Map(quests.value.map(quest => [quest.id, quest])))
  const scenesById = computed(() => new Map(scenes.value.map(scene => [scene.id, scene])))

  function applyResponse(response) {
    world.value = response?.world || response || EMPTY_WORLD
    loaded.value = true
    return response?.id || null
  }

  async function load(force = false) {
    if (loaded.value && !force) return world.value
    if (loadPromise) return loadPromise
    loading.value = true
    error.value = ''
    loadPromise = getSessionWorld(sessionUuid)
      .then(applyResponse)
      .catch(cause => {
        error.value = cause?.message || 'Не удалось загрузить мир сессии'
        throw cause
      })
      .finally(() => {
        loading.value = false
        loadPromise = null
      })
    return loadPromise
  }

  async function mutate(action, fallback) {
    if (saving.value) return null
    saving.value = true
    error.value = ''
    try {
      return applyResponse(await action())
    } catch (cause) {
      error.value = cause?.message || fallback
      throw cause
    } finally {
      saving.value = false
    }
  }

  const saveLocation = (location, data) => mutate(
    () => location
      ? updateSessionLocation(sessionUuid, location.id, data)
      : createSessionLocation(sessionUuid, data),
    'Не удалось сохранить локацию',
  )
  const moveLocation = (locationId, data) => mutate(
    () => moveSessionLocation(sessionUuid, locationId, data),
    'Не удалось переместить локацию',
  )
  const removeLocation = locationId => mutate(
    () => deleteSessionLocation(sessionUuid, locationId),
    'Не удалось удалить локацию',
  )
  const saveNpc = (npc, data) => mutate(
    () => npc
      ? updateSessionNpc(sessionUuid, npc.id, data)
      : createSessionNpc(sessionUuid, data),
    'Не удалось сохранить NPC',
  )
  const removeNpc = npcId => mutate(
    () => deleteSessionNpc(sessionUuid, npcId),
    'Не удалось удалить NPC',
  )
	const saveQuest = (quest, data) => mutate(
		() => quest
			? updateSessionQuest(sessionUuid, quest.id, data)
			: createSessionQuest(sessionUuid, data),
		'Не удалось сохранить задание',
	)
	const removeQuest = questId => mutate(
		() => deleteSessionQuest(sessionUuid, questId),
		'Не удалось удалить задание',
	)

  return {
    world, locations, npcs, quests, scenes, locationsById, npcsById, questsById, scenesById,
    loading, loaded, saving, error,
    load, saveLocation, moveLocation, removeLocation, saveNpc, removeNpc, saveQuest, removeQuest,
  }
}
