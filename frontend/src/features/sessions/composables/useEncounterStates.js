import { computed } from 'vue'
import { getByPath } from '@/features/sessions/lib/encounterHelpers'
import { charactersApi } from '@/shared/api/charactersApi'
import { useTemplateStore } from '@/stores/template'

function findStatesBlock(templateStore, templateId) {
  if (!templateId) return null
  const tpl = templateStore.byId(templateId)
  const blocks = tpl?.schema?.blocks
  if (!blocks || typeof blocks !== 'object') return null
  for (const [id, b] of Object.entries(blocks)) {
    if (b?.type === 'BLOCK_STATES') {
      const sid = b.content?.suggest_id
      if (sid != null) return { blockId: id, suggestId: sid }
    }
  }
  return null
}

export function useEncounterStates({
  participants,
  findParticipant,
  applyLocalPatches,
  getCombatant,
  mutate,
}) {
  const templateStore = useTemplateStore()

  const defaultStatesSuggestId = computed(() => {
    for (const p of participants.value) {
      const cfg = findStatesBlock(templateStore, p.templateId)
      if (cfg) return cfg.suggestId
    }
    return null
  })

  function statesBlock(c) {
    if (c.type === 'player') {
      const p = findParticipant(c.charId)
      const cfg = p ? findStatesBlock(templateStore, p.templateId) : null
      if (!cfg) return null
      return { id: cfg.blockId, title: 'статус', content: { suggest_id: cfg.suggestId, variant: 'compact' }, props: {} }
    }
    const sid = defaultStatesSuggestId.value
    if (sid == null) return null
    return { id: 'npc-states', title: 'статус', content: { suggest_id: sid, variant: 'compact' }, props: {} }
  }

  function statesValue(c) {
    if (c.type === 'player') {
      const p = findParticipant(c.charId)
      const cfg = p ? findStatesBlock(templateStore, p.templateId) : null
      if (!cfg) return []
      const raw = getByPath(p.data ?? {}, `values.${cfg.blockId}`)
      return Array.isArray(raw) ? raw : []
    }
    return Array.isArray(c.states) ? c.states : []
  }

  async function setStates(c, ids) {
    const list = Array.isArray(ids) ? ids : []
    if (c.type === 'player') {
      const p = findParticipant(c.charId)
      const cfg = p ? findStatesBlock(templateStore, p.templateId) : null
      if (!p || !cfg) return
      const updates = [{ path: `values.${cfg.blockId}`, value: list }]
      applyLocalPatches(c.charId, updates)
      await charactersApi.patchData(p.charUuid, updates)
      return
    }
    mutate(() => {
      const t = getCombatant(c.uid)
      if (t) t.states = list
    })
  }

  function setNote(c, text) {
    const value = (text ?? '').toString()
    mutate(() => {
      const t = getCombatant(c.uid)
      if (!t) return
      if (value) t.note = value
      else delete t.note
    })
  }

  return {
    statesBlock,
    statesValue,
    setStates,
    setNote,
  }
}
