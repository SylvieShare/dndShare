import { computed, ref, watch } from 'vue'

export const SESSION_PRIMARY_VIEWS = new Set(['story', 'locations', 'npcs', 'materials', 'quests', 'music', 'journal', 'events'])

export function sessionPrimaryViewKey(sessionUuid) {
  return `dnd-share:session-primary-view:v1:${sessionUuid}`
}

function savedPrimaryView(sessionUuid) {
  try {
    const saved = localStorage.getItem(sessionPrimaryViewKey(sessionUuid))
    return SESSION_PRIMARY_VIEWS.has(saved) ? saved : null
  } catch {
    return null
  }
}

export function useSessionPrimaryView({ sessionUuid, route, router }) {
  const fromQuery = String(route.query.view || '')
  const activeView = ref(
    SESSION_PRIMARY_VIEWS.has(fromQuery)
      ? fromQuery
      : savedPrimaryView(sessionUuid) || 'story',
  )

  const selectedLocationId = computed(() => {
    const value = Number(route.query.location)
    return Number.isInteger(value) && value > 0 ? value : null
  })
  const selectedNpcId = computed(() => {
    const value = Number(route.query.npc)
    return Number.isInteger(value) && value > 0 ? value : null
  })
	const selectedQuestId = computed(() => {
		const value = Number(route.query.quest)
		return Number.isInteger(value) && value > 0 ? value : null
	})
	const selectedMaterialId = computed(() => {
		const value = Number(route.query.material)
		return Number.isInteger(value) && value > 0 ? value : null
	})

  function replaceQuery(patch) {
    const query = { ...route.query, ...patch }
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') delete query[key]
    }
    return router.replace({ query })
  }

  function selectView(view) {
    if (!SESSION_PRIMARY_VIEWS.has(view) || view === activeView.value) return
    activeView.value = view
    persistView(view)
    replaceQuery({ view: view === 'story' ? null : view })
  }

  function selectLocation(id) {
    activeView.value = 'locations'
    persistView('locations')
	replaceQuery({ view: 'locations', location: id || null })
  }

  function selectNpc(id) {
    activeView.value = 'npcs'
    persistView('npcs')
	replaceQuery({ view: 'npcs', npc: id || null })
  }

	function selectQuest(id) {
		activeView.value = 'quests'
		persistView('quests')
		replaceQuery({ view: 'quests', quest: id || null })
	}

	function selectMaterial(id) {
		activeView.value = 'materials'
		persistView('materials')
		replaceQuery({ view: 'materials', material: id || null })
	}

  function persistView(view) {
    try { localStorage.setItem(sessionPrimaryViewKey(sessionUuid), view) } catch { /* ignore */ }
  }

  watch(() => route.query.view, value => {
    const view = String(value || '')
    activeView.value = SESSION_PRIMARY_VIEWS.has(view) ? view : savedPrimaryView(sessionUuid) || 'story'
    if (SESSION_PRIMARY_VIEWS.has(view)) persistView(view)
  })

	return { activeView, selectedLocationId, selectedNpcId, selectedQuestId, selectedMaterialId, selectView, selectLocation, selectNpc, selectQuest, selectMaterial }
}
