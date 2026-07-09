import { getByPath } from '@/features/sessions/lib/encounterHelpers'
import { abilityModifier, d20Expr } from '@/shared/lib/dnd'
import { useDiceStore } from '@/stores/dice'
import { useTemplateStore } from '@/stores/template'

function findFirstBlockByType(templateStore, templateId, type) {
  if (!templateId) return null
  const tpl = templateStore.byId(templateId)
  const blocks = tpl?.schema?.blocks
  if (!blocks || typeof blocks !== 'object') return null
  for (const [id, b] of Object.entries(blocks)) {
    if (b?.type === type) return { blockId: id, content: b.content || {} }
  }
  return null
}

export function useEncounterInitiative({ findParticipant, playerDisplayName, npcDex, npcName }) {
  const templateStore = useTemplateStore()

  function playerInitiativeBonus(c) {
    const p = findParticipant(c.charId)
    if (!p) return 0
    const cfg = findFirstBlockByType(templateStore, p.templateId, 'DND_INITIATIVE')
    if (!cfg) return 0
    const raw = getByPath(p.data ?? {}, `values.${cfg.blockId}`)
    if (raw == null) return 0
    if (typeof raw === 'number') return raw
    if (typeof raw === 'object') {
      if (Number.isFinite(Number(raw.value))) return Number(raw.value)
      const base = Number(raw.base) || 0
      const bonuses = Array.isArray(raw.bonuses)
        ? raw.bonuses.reduce((s, b) => s + (Number(b?.value) || 0), 0)
        : 0
      return base + bonuses
    }
    return Number(raw) || 0
  }

  function npcInitiativeBonus(c) {
    const dex = npcDex ? npcDex(c) : null
    if (dex == null || !Number.isFinite(Number(dex))) return 0
    return abilityModifier(dex)
  }

  function initiativeBonus(c) {
    if (c.type === 'player') return playerInitiativeBonus(c)
    if (c.type === 'npc') return npcInitiativeBonus(c)
    return 0
  }

  function rollInitiativeFor(c) {
    const name = c.type === 'player' ? playerDisplayName(c) : (npcName ? npcName(c) : 'Бросок')
    const bonus = initiativeBonus(c)
    const expr = d20Expr(bonus)
    const result = useDiceStore().roll(`${name} — инициатива`, expr)
    return Number(result?.total) || 0
  }

  return {
    initiativeBonus,
    rollInitiativeFor,
  }
}
