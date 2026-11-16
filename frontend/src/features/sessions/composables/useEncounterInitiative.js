import { encounterEventData } from '../lib/encounterEventData'
import { settingSheetDefinition } from '@/features/character-editor/settings'
import { getByPath } from '@/features/sessions/lib/encounterHelpers'
import { abilityModByPath, abilityModifier, d20Expr, resolveNumValue } from '@/shared/lib/dnd'
import { useDiceStore } from '@/stores/dice'
import { useTemplateStore } from '@/stores/template'
import {unref,computed} from 'vue'
import {resolveRedInitiative} from '@/features/character-editor/settings/cyberpunk-red/checks'
import {redEffectiveStats} from '@/features/character-editor/settings/cyberpunk-red/equipment'
import {useRedCatalogue} from '@/features/character-editor/composables/useRedCatalogue'

function findFirstBlockByType(templateStore, templateId, type) {
  if (!templateId) return null
  const tpl = templateStore.byId(templateId)
  const blocks = settingSheetDefinition(tpl)?.blocks
  if (!blocks || typeof blocks !== 'object') return null
  for (const [id, b] of Object.entries(blocks)) {
    if (b?.type === type) return { blockId: id, content: b.content || {} }
  }
  return null
}

export function useEncounterInitiative({ findParticipant, playerDisplayName, npcDex, npcName, systemName }) {
  const templateStore = useTemplateStore()
  const isRed=computed(()=>unref(systemName)==='Cyberpunk')
  const redCatalogue=useRedCatalogue(isRed)

  function playerInitiativeBonus(c) {
    const p = findParticipant(c.charId)
    if (!p) return 0
    if(p.data?.system==='cyberpunk-red'){
      const stats=redEffectiveStats(p.data.values,redCatalogue.items.value),solo=p.data.values.roles?.find(r=>r.key==='solo')
      const cyber=p.data.values.cyberware?.installations||[]
      return stats.REF+(solo?.choices?.initiative||0)+(cyber.some(e=>e.key==='cyberware-kerenzikov'&&!e.disabled)?2:cyber.some(e=>e.key==='cyberware-sandevistan'&&e.active&&!e.disabled)?3:0)
    }
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
    if(isRed.value)return Number(c.override?.redStats?.REF)||0
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
    if(isRed.value||participant?.data?.system==='cyberpunk-red'){
      const die=1+Math.floor(Math.random()*10),extraDie=die===1||die===10?1+Math.floor(Math.random()*10):null
      const roll=resolveRedInitiative({reflexes:bonus,die,extraDie})
      const parts=[{kind:'dice',n:1,sides:10,rolls:[die],sum:die,sign:'+',operator:'+'},{kind:'flat',value:bonus,sum:bonus,sign:'+',operator:'+'}]
      if(extraDie!=null)parts.push({kind:'dice',n:1,sides:10,rolls:[extraDie],sum:extraDie,sign:die===1?'-':'+',operator:die===1?'-':'+'})
      useDiceStore().pushEntry({action:'Инициатива RED',actor:{name,charUuid:participant?.charUuid||null},eventData:{...encounterEventData(c,name),system:'cyberpunk-red'},result:{total:roll.total,expression:`1d10+${bonus}`,parts,byType:[]}})
      return roll.total
    }
    const expr = d20Expr(bonus)
    const result = useDiceStore().roll('Инициатива', expr, {
      eventData: { ...encounterEventData(c, name), ability: { id: 2, typeId: 16, name: 'Ловкость' } },
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
