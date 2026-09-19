import { ref } from 'vue'

const typeIds = entry => [...new Set((entry.item?.data?.damage?.type_choices || []).map(Number).filter(id => id > 0))]
const choiceKey = entry => `${entry.ref?.key || `${entry.item?.id}:${entry.ref?.source_key || ''}`}|${typeIds(entry).sort((a, b) => a - b).join(',')}`

/** Menu state lives with the spell block, so closing the attack menu keeps the damage choice. */
export function useSpellDamageTypes(suggests) {
  const choices = ref({})
  const options = entry => typeIds(entry).flatMap(id => {
    const type = suggests.value.find(row => Number(row.id) === id)
    return type ? [{ value: id, label: type.value, color: type.color, svg: type.svg }] : []
  })
  function selected(entry) {
    const allowed = options(entry), saved = choices.value[choiceKey(entry)]
    return allowed.find(type => type.value === saved) || (typeIds(entry).length === 1 ? allowed[0] : null)
  }
  function select(entry, id) {
    if (options(entry).some(type => type.value === Number(id))) choices.value[choiceKey(entry)] = Number(id)
  }
  const required = entry => typeIds(entry).length > 0
  const ready = entry => !required(entry) || !!selected(entry)
  function resolve(entry) {
    if (!required(entry)) return entry
    const type = selected(entry)
    if (!type) return null
    const rule = entry.item.data.damage
    const rows = key => rule[key]?.map(row => row.type ? row : { ...row, type: type.value })
    return { ...entry, damageType: { id: type.value, label: type.label, color: type.color },
      item: { ...entry.item, data: { ...entry.item.data, damage: { ...rule, dices: rows('dices'), addon: rows('addon') } } } }
  }
  return { options, selected, select, required, ready, resolve }
}
