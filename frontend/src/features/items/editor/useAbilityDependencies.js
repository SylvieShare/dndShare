import { computed, ref } from 'vue'
import { activeAbilityBlocks, addAbilityBlock, removeAbilityBlock } from './abilityEditorProfile'
import { defaultDataForFields } from '@/features/handbook/objects/lib/schemaFields'

export function useAbilityDependencies(profile, data) {
  const active = new Set(activeAbilityBlocks(profile.value.blocks, data))
  const cards = ref(profile.value.blocks.flatMap(block => block.repeatable
    ? (data[block.key] || []).map((_, index) => ({ id: crypto.randomUUID(), key: block.key, index }))
    : active.has(block.key) ? [{ id: crypto.randomUUID(), key: block.key, index: null }] : []))
  const entries = computed(() => cards.value.map(card => ({ ...card, block: profile.value.blocks.find(block => block.key === card.key) })))
  const available = computed(() => profile.value.blocks.filter(block => block.repeatable || !cards.value.some(card => card.key === block.key)))
  function add(block) {
    if (block.repeatable) {
      const rows = data[block.key] || []
      data[block.key] = [...rows, defaultDataForFields(block.fields[0].fields)]
      cards.value.push({ id: crypto.randomUUID(), key: block.key, index: rows.length })
    } else {
      addAbilityBlock(block, data)
      cards.value.push({ id: crypto.randomUUID(), key: block.key, index: null })
    }
  }
  function remove(card) {
    if (card.index == null) removeAbilityBlock(card.block, data)
    else {
      data[card.key] = data[card.key].filter((_, index) => index !== card.index)
      cards.value.forEach(other => { if (other.key === card.key && other.index > card.index) other.index-- })
    }
    cards.value = cards.value.filter(other => other.id !== card.id)
  }
  function update(card, value) {
    if (card.index == null) Object.assign(data, value)
    else Object.assign(data[card.key][card.index], value)
  }
  return { entries, available, add, remove, update }
}
