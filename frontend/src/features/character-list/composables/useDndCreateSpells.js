import { computed, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { chosenOptionLabels, grantedSpellsAt } from '@/features/character-editor/blocks/dnd/lib/levelUp'
import { spellSelectionComplete } from '@/features/character-list/components/wizard/spellSelection'

export function useDndCreateSpells({ state, spellPool, grants }) {
  // ─── Spells: cantrips vs 1st-level, each count-limited ─────────────────────
  const cantripPool = computed(() => spellPool.value.filter((sp) => Number(sp.data?.lvl ?? 0) === 0))
  const spell1Pool = computed(() => spellPool.value.filter((sp) => Number(sp.data?.lvl ?? 0) === 1))
  const cantripLimit = computed(() => grants.value.spellcasting?.cantripsKnown || 0)
  const spell1Limit = computed(() => grants.value.spellcasting?.spellsKnown || 0)
  const cantripChosen = computed(() => state.spellIds.filter((id) => cantripPool.value.some((sp) => sp.id === id)).length)
  const spell1Chosen = computed(() => state.spellIds.filter((id) => spell1Pool.value.some((sp) => sp.id === id)).length)
  function toggleSpell(id, kind) {
    const i = state.spellIds.indexOf(id)
    if (i >= 0) { state.spellIds.splice(i, 1); return }
    const chosen = kind === 'cantrip' ? cantripChosen.value : spell1Chosen.value
    const limit = kind === 'cantrip' ? cantripLimit.value : spell1Limit.value
    if (limit && chosen >= limit) return
    state.spellIds.push(id)
  }
  const spellsComplete = computed(() => (
    spellSelectionComplete(cantripChosen.value, cantripLimit.value)
    && spellSelectionComplete(spell1Chosen.value, spell1Limit.value)
  ))

  // ─── Даруемые заклинания архетипа (домен жреца на 1 уровне) ────────────────
  const grantedSpellIds = computed(() => [...new Set(grantedSpellsAt(
    [state.charClass, state.subclass].filter(Boolean),
    1,
    { options: chosenOptionLabels(state.choices) },
  ).map((r) => r.spellId))])
  const grantedSpellItems = ref({})
  watch(grantedSpellIds, async (ids) => {
    const missing = ids.filter((id) => !grantedSpellItems.value[id])
    if (!missing.length) return
    const res = await fetchGet('/items/by-ids?ids=' + missing.join(','))
    const next = { ...grantedSpellItems.value }
    ;(res?.items || []).forEach((it) => { next[it.id] = it })
    grantedSpellItems.value = next
  }, { immediate: true })
  const grantedSpellList = computed(() => grantedSpellIds.value.map((id) => (
    grantedSpellItems.value[id] || { id, name: `#${id}`, data: {} }
  )))

  return { cantripPool, spell1Pool, cantripLimit, spell1Limit, cantripChosen, spell1Chosen, toggleSpell, spellsComplete, grantedSpellList }
}
