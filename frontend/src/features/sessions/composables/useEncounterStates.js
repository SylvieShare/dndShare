import { computed } from 'vue'
import { settingRenderSchema } from '@/features/character-editor/settings'
import { getByPath } from '@/features/sessions/lib/encounterHelpers'
import { charactersApi } from '@/shared/api/charactersApi'
import { useTemplateStore } from '@/stores/template'

const DND_STATES_SUGGEST_ID = 9

function findStatesBlock(templateStore, templateId) {
  if (!templateId) return null
  const tpl = templateStore.byId(templateId)
  const blocks = settingRenderSchema(tpl)?.blocks
  if (!blocks || typeof blocks !== 'object') return null
  for (const [id, b] of Object.entries(blocks)) {
    if (b?.type === 'BLOCK_STATES') {
      const sid = b.content?.suggest_id
      if (sid != null) return { valueId: id, suggestId: sid }
    }
  }
  for (const b of Object.values(blocks)) {
    if (b?.type === 'DND_STATUS_OVERVIEW' || b?.type === 'DND_MOBILE_STATUS_MENU') {
      return {
        valueId: b.content?.states_id || 'states',
        suggestId: b.content?.states_suggest_id || DND_STATES_SUGGEST_ID,
        effectItemTypeId: Number(b.content?.effect_item_type_id) || null,
      }
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
    return DND_STATES_SUGGEST_ID
  })

  function statesBlock(c) {
    if (c.type === 'player') {
      const p = findParticipant(c.charId)
      const cfg = p ? findStatesBlock(templateStore, p.templateId) : null
      // Structured character effects need a dedicated encounter control that
      // preserves source, duration and parameters. Do not feed them through the
      // legacy suggest editor: it would overwrite the runtime instances.
      if (!cfg || cfg.effectItemTypeId) return null
      return { id: cfg.valueId, title: 'состояние', content: { suggest_id: cfg.suggestId, variant: 'compact' }, props: {} }
    }
    const sid = defaultStatesSuggestId.value
    return { id: 'npc-states', title: 'состояние', content: { suggest_id: sid, variant: 'compact' }, props: {} }
  }

  function statesValue(c) {
    if (c.type === 'player') {
      const p = findParticipant(c.charId)
      const cfg = p ? findStatesBlock(templateStore, p.templateId) : null
      if (!cfg || cfg.effectItemTypeId) return []
      const raw = getByPath(p.data ?? {}, `values.${cfg.valueId}`)
      return Array.isArray(raw) ? raw : []
    }
    return Array.isArray(c.states) ? c.states : []
  }

  async function setStates(c, ids) {
    const list = Array.isArray(ids) ? ids : []
    if (c.type === 'player') {
      const p = findParticipant(c.charId)
      const cfg = p ? findStatesBlock(templateStore, p.templateId) : null
      if (!p || !cfg || cfg.effectItemTypeId) return
      const updates = [{ path: `values.${cfg.valueId}`, value: list }]
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
