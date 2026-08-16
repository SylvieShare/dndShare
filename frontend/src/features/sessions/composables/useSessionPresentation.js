import { computed, ref } from 'vue'
import { getSessionPresentation, saveSessionPresentation } from '@/shared/api/sessionsApi'

export function useSessionPresentation({ sessionUuid, materials, musicStore }) {
  const state = ref({ mode: 'idle', visible: false, effect: 'none', transition: 'fade', revision: 0 })
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  const activeLabel = computed(() => {
    if (!state.value.visible) return 'Экран затемнён'
    if (state.value.mode === 'combat') return 'Показывается бой'
    if (state.value.mode === 'scene') return state.value.scene?.name || 'Показывается сцена'
    if (state.value.mode === 'material') return state.value.material?.name || 'Показывается материал'
    return 'Ничего не показывается'
  })

  async function load() {
    loading.value = true
    try {
      state.value = await getSessionPresentation(sessionUuid)
    } catch {
      error.value = 'Не удалось загрузить состояние экрана'
    } finally {
      loading.value = false
    }
  }

  async function save(payload) {
    if (saving.value) return state.value
    saving.value = true
    error.value = ''
    try {
      state.value = await saveSessionPresentation(sessionUuid, payload)
      return state.value
    } catch {
      error.value = 'Не удалось обновить экран показа'
      throw new Error(error.value)
    } finally {
      saving.value = false
    }
  }

  const showMaterial = material => save({
    mode: 'material', visible: true, materialId: material?.id, effect: state.value.effect || 'none', transition: 'fade',
  })

  async function startScene(scene) {
    if (!scene) return
    const crossfade = scene.presentationCrossfadeSec
    const volume = scene.presentationVolume
    if (volume != null) musicStore?.setVolume(volume)
    if (crossfade != null) musicStore?.setCrossfade(crossfade)
    if (scene.presentationTrackId) {
      await musicStore?.playTrack(scene.presentationTrackId, { immediate: scene.presentationTransition === 'cut' })
    }
    return save({
      mode: 'scene', visible: true, sceneId: scene.id,
      materialId: scene.presentationMaterialId || null,
      effect: scene.presentationEffect || 'none', transition: scene.presentationTransition || 'fade',
    })
  }

  const showCombat = () => save({ mode: 'combat', visible: true, effect: 'none', transition: 'fade' })
  const blackout = () => save({ ...state.value, visible: false, materialId: state.value.materialId || null, sceneId: state.value.sceneId || null })
  const reveal = () => state.value.mode === 'idle'
    ? save({ mode: 'idle', visible: true, effect: 'none', transition: 'fade' })
    : save({ ...state.value, visible: true, materialId: state.value.materialId || null, sceneId: state.value.sceneId || null })
  const clear = () => save({ mode: 'idle', visible: true, effect: 'none', transition: 'fade' })
  const setEffect = effect => save({ ...state.value, effect, materialId: state.value.materialId || null, sceneId: state.value.sceneId || null })

  return { state, loading, saving, error, activeLabel, load, save, showMaterial, startScene, showCombat, blackout, reveal, clear, setEffect, materialById: materials?.byId }
}
