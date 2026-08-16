import { ref } from 'vue'
import {
  createSessionMaterial,
  deleteSessionMaterial,
  getSessionMaterials,
  updateSessionMaterial,
} from '@/shared/api/sessionsApi'

export function useSessionMaterials({ sessionUuid }) {
  const materials = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let loadPromise = null

  async function load(force = false) {
    if (loaded.value && !force) return materials.value
    if (loadPromise) {
      if (!force) return loadPromise
      try {
        await loadPromise
      } catch { /* forced refresh below gets its own result */ }
      return load(true)
    }
    loading.value = true
    error.value = ''
    loadPromise = getSessionMaterials(sessionUuid)
      .then(result => {
        materials.value = result?.materials || []
        loaded.value = true
        return materials.value
      })
      .catch(() => {
        error.value = 'Не удалось загрузить материалы'
        throw new Error(error.value)
      })
      .finally(() => {
        loading.value = false
        loadPromise = null
      })
    return loadPromise
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

  function availableFor() {
    return materials.value
  }

  return { materials, loading, loaded, error, load, create, update, remove, byId, availableFor }
}
