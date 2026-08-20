import { computed, ref } from 'vue'
import { getSessionPresentation, getSessionPresentationConnections, saveSessionPresentation } from '@/shared/api/sessionsApi'

export function useSessionPresentation({ sessionUuid, materials }) {
  const state = ref({
    mode: 'idle', visible: false, broadcastMusic: false,
    showHealth: false, healthDisplay: 'numbers', showGraveyard: false, displayScale: 100,
    effect: 'none', transition: 'fade', revision: 0,
  })
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const connectedScreens = ref(0)
  const connectionsLoading = ref(false)
  const connectionsError = ref('')

  const activeLabel = computed(() => {
    if (!state.value.visible) return 'Экран затемнён'
    if (state.value.mode === 'combat') return 'Показывается бой'
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

  async function loadConnections() {
    if (connectionsLoading.value) return
    connectionsLoading.value = true
    try {
      const response = await getSessionPresentationConnections(sessionUuid)
      connectedScreens.value = Math.max(0, Math.floor(Number(response?.connectedScreens) || 0))
      connectionsError.value = ''
    } catch {
      connectionsError.value = 'Не удалось проверить подключённые экраны'
    } finally {
      connectionsLoading.value = false
    }
  }

  function setConnectedScreens(count) {
    connectedScreens.value = Math.max(0, Math.floor(Number(count) || 0))
    connectionsError.value = ''
  }

  async function save(payload) {
    if (saving.value) return state.value
    saving.value = true
    error.value = ''
    try {
      state.value = await saveSessionPresentation(sessionUuid, {
        ...payload,
        broadcastMusic: payload.broadcastMusic ?? state.value.broadcastMusic ?? false,
        showHealth: payload.showHealth ?? state.value.showHealth ?? false,
        healthDisplay: payload.healthDisplay ?? state.value.healthDisplay ?? 'numbers',
        showGraveyard: payload.showGraveyard ?? state.value.showGraveyard ?? false,
        displayScale: payload.displayScale ?? state.value.displayScale ?? 100,
      })
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

  const showCombat = () => save({ mode: 'combat', visible: true, effect: 'none', transition: 'fade' })
  const blackout = () => save({ ...state.value, visible: false, materialId: state.value.materialId || null })
  const reveal = () => state.value.mode === 'idle'
    ? save({ mode: 'idle', visible: true, effect: 'none', transition: 'fade' })
    : save({ ...state.value, visible: true, materialId: state.value.materialId || null })
  const clear = () => save({ mode: 'idle', visible: true, effect: 'none', transition: 'fade' })
  const setEffect = effect => save({ ...state.value, effect, materialId: state.value.materialId || null })
  const setBroadcastMusic = enabled => save({ ...state.value, broadcastMusic: !!enabled, materialId: state.value.materialId || null })
  const setDisplayOption = (key, enabled) => save({
    ...state.value,
    [key]: !!enabled,
    materialId: state.value.materialId || null,
  })
  const setHealthDisplay = healthDisplay => save({
    ...state.value,
    healthDisplay,
    materialId: state.value.materialId || null,
  })
  const setDisplayScale = displayScale => save({
    ...state.value,
    displayScale: Math.min(125, Math.max(75, Math.round(Number(displayScale) || 100))),
    materialId: state.value.materialId || null,
  })

  return {
    state, loading, saving, error, activeLabel,
    connectedScreens, connectionsLoading, connectionsError,
    load, loadConnections, setConnectedScreens,
    save, showMaterial, showCombat, blackout, reveal, clear, setEffect, setBroadcastMusic, setDisplayOption, setHealthDisplay, setDisplayScale,
    materialById: materials?.byId,
  }
}
