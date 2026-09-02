import { settingRenderSchema } from '@/features/character-editor/settings'
import { getByPath } from '@/features/sessions/lib/encounterHelpers'
import { abilityModByPath, abilityModifier, d20Expr, resolveNumValue } from '@/shared/lib/dnd'
import { useDiceStore } from '@/stores/dice'
import { useTemplateStore } from '@/stores/template'

function findFirstBlockByType(templateStore, templateId, type) {
  if (!templateId) return null
  const tpl = templateStore.byId(templateId)
  const blocks = settingRenderSchema(tpl)?.blocks
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
    let bonus = resolveNumValue(raw)
    if (raw && typeof raw === 'object' && raw.use_dex) {
      bonus += abilityModByPath(p.data?.values, cfg.content?.dex_mod_path) || 0
    }
    return bonus
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
    const participant = c.type === 'player' ? findParticipant(c.charId) : null
    const bonus = initiativeBonus(c)
    const expr = d20Expr(bonus)
    const result = useDiceStore().roll('Инициатива', expr, {
      actor: {
        name,
        charUuid: participant?.charUuid || null,
        itemId: c.type === 'npc' ? c.itemId || null : null,
      },
    })
    return Number(result?.total) || 0
  }

  return {
    initiativeBonus,
    rollInitiativeFor,
  }
}
