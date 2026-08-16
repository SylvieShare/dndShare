import { computed, ref } from 'vue'
import {
  createSessionMaterial,
  deleteSessionMaterial,
  getSessionMaterials,
  updateSessionMaterial,
} from '@/shared/api/sessionsApi'

export function useSessionMaterials({ sessionUuid }) {
  const materials = ref([])
  const chapters = ref([])
  const scenes = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')

  async function load(force = false) {
    if ((loaded.value && !force) || loading.value) return
    loading.value = true
    error.value = ''
    try {
      const result = await getSessionMaterials(sessionUuid)
      materials.value = result?.materials || []
      chapters.value = result?.chapters || []
      scenes.value = result?.scenes || []
      loaded.value = true
    } catch {
      error.value = 'Не удалось загрузить материалы'
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function create(payload) {
    const material = await createSessionMaterial(sessionUuid, payload)
    materials.value = [...materials.value, material]
    return material
  }

  async function update(materialId, payload) {
    const material = await updateSessionMaterial(sessionUuid, materialId, payload)
    materials.value = materials.value.map(item => item.id === material.id ? material : item)
    return material
  }

  async function remove(materialId) {
    await deleteSessionMaterial(sessionUuid, materialId)
    materials.value = materials.value.filter(item => item.id !== materialId)
  }

  function byId(materialId) {
    return materials.value.find(item => String(item.id) === String(materialId)) || null
  }

  function availableFor(chapterId, sceneId = null) {
    return materials.value.filter(material => {
      if (material.scope === 'session') return true
      if (material.scope === 'chapter') return String(material.chapterId) === String(chapterId)
      return sceneId != null && String(material.sceneId) === String(sceneId)
    })
  }

  const grouped = computed(() => ({
    session: materials.value.filter(item => item.scope === 'session'),
    chapter: materials.value.filter(item => item.scope === 'chapter'),
    scene: materials.value.filter(item => item.scope === 'scene'),
  }))

  return { materials, chapters, scenes, grouped, loading, loaded, error, load, create, update, remove, byId, availableFor }
}
