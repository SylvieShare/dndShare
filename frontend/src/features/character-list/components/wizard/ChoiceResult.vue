<template>
  <section class="result" aria-live="polite">
    <header class="result-head">
      <span class="result-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6" /></svg>
      </span>
      <span>
        <span class="result-title">Результат выбора</span>
        <span class="result-note">Это будет добавлено в лист персонажа</span>
      </span>
    </header>

    <div v-if="facts.length" class="result-facts">
      <div v-for="fact in facts" :key="fact.label" class="result-fact">
        <span class="result-label">{{ fact.label }}</span>
        <span class="result-value">{{ fact.value }}</span>
      </div>
    </div>

    <div v-if="abilities.length" class="result-abilities">
      <span class="result-label">Способности</span>
      <div class="ability-list">
        <template v-for="ability in abilities" :key="ability.id">
          <details v-if="ability.desc" class="ability">
            <summary>
              <span>{{ ability.name }}</span>
              <small v-if="ability.choices.length">{{ ability.choices.join(', ') }}</small>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </summary>
            <RichContent class="ability-desc" :html="ability.desc" />
          </details>
          <div v-else class="ability ability-static">
            <span>{{ ability.name }}</span>
            <small v-if="ability.choices.length">{{ ability.choices.join(', ') }}</small>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, inject } from 'vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
import { sourceSkillLabels } from '@/features/character-list/components/wizard/previewSkills'
import { STAT_SHORT } from '@/features/character-list/components/wizard/labels'
import { itemChoiceRows } from '@/features/items/lib/itemChoices'

const props = defineProps({ source: { type: String, required: true } })
const {
  state, grants, suggestValue, raceAbilities, classAbilities, featPool,
  classEquipment, spellPool, grantedSpellList, choiceOptionList,
} = inject('createWizard')

function names(ids, typeId) {
  return [...new Set((ids || []).map((id) => suggestValue(typeId, id)).filter(Boolean))]
}
function itemIds(items, key) {
  return items.flatMap((item) => Array.isArray(item?.data?.[key]) ? item.data[key] : [])
}
function itemProficiencies(items) {
  return [
    ...names(itemIds(items, 'armor_prof'), 3),
    ...names(itemIds(items, 'weapon_prof'), 4),
    ...names(itemIds(items, 'tool_prof'), 5),
  ]
}
function selectedChoiceLabels(item) {
  return itemChoiceRows(item).flatMap((row) => {
    const selected = state.choices[row.id] || []
    if (row.choice.from_suggest_id != null) return names(selected, Number(row.choice.from_suggest_id))
    return selected.map((value) => {
      const option = choiceOptionList(row).find((entry) => String(entry.value) === String(value))
      return option?.label || String(value)
    })
  })
}
function skillChoiceRows(item) { return itemChoiceRows(item).filter((row) => Number(row.choice.from_suggest_id) === 15) }
function isSkillChoice(item) { return skillChoiceRows(item).length > 0 }
function isExpertise(item) { return isSkillChoice(item) && /компетентност/i.test(item?.name || '') }
function boundFeatures(source) {
  if (source === 'race') {
    return featuresForBinding(raceAbilities.value, { raceId: state.race?.id, subraceId: state.subrace?.id }, 1)
  }
  return featuresForBinding(classAbilities.value, { classId: state.charClass?.id, subclassId: state.subclass?.id }, 1)
}
function formatEquipment(items) {
  return items.map((entry) => entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name).join(', ')
}
function pushFact(list, label, value) {
  if (value && value.length) list.push({ label, value })
}

const sourceFeatures = computed(() => boundFeatures(props.source))
const abilities = computed(() => sourceFeatures.value
  .filter((item) => item.name && !isSkillChoice(item))
  .map((item) => ({
    id: item.id,
    name: item.name,
    desc: item.data?.desc || '',
    choices: selectedChoiceLabels(item),
  })))

const skillLabels = computed(() => {
  const featureSkillIds = sourceFeatures.value
    .filter((item) => isSkillChoice(item) && !isExpertise(item))
    .flatMap((item) => skillChoiceRows(item).flatMap((row) => state.choices[row.id] || []))
  const expertiseIds = sourceFeatures.value
    .filter(isExpertise)
    .flatMap((item) => skillChoiceRows(item).flatMap((row) => state.choices[row.id] || []))
  return sourceSkillLabels({
    proficiencyIds: props.source === 'race' ? state.raceSkillIds : state.skillIds,
    featureIds: featureSkillIds,
    expertiseIds,
    labelFor: (id) => suggestValue(15, id),
  })
})

const facts = computed(() => {
  const result = []
  const g = grants.value

  if (props.source === 'race') {
    const raceItems = [state.race, state.subrace].filter(Boolean)
    const asi = (g.asi || []).map((entry) => `${STAT_SHORT[entry.stat]} +${entry.bonus}`)
    if (g.asiChoice) asi.push(...state.asiChoice.map((stat) => `${STAT_SHORT[stat]} +${g.asiChoice.bonus}`))
    pushFact(result, 'Характеристики', asi.join(', '))
    pushFact(result, 'Скорость', g.speed != null ? `${g.speed} фт` : '')
    pushFact(result, 'Размер', g.size || '')
    pushFact(result, 'Языки', names([...itemIds(raceItems, 'languages'), ...state.raceLangIds], 6).join(', '))
    pushFact(result, 'Навыки', skillLabels.value.join(', '))
    pushFact(result, 'Владения', itemProficiencies(raceItems).join(', '))
    pushFact(result, 'Черты', state.featIds.map((id) => featPool.value.find((item) => String(item.id) === String(id))?.name).filter(Boolean).join(', '))
    return result
  }

  const classItems = [state.charClass, state.subclass].filter(Boolean)
  pushFact(result, 'Кость хитов', g.hitDieId || '')
  pushFact(result, 'Спасброски', (g.saves || []).map((stat) => STAT_SHORT[stat]).filter(Boolean).join(', '))
  pushFact(result, 'Навыки', skillLabels.value.join(', '))
  pushFact(result, 'Владения', itemProficiencies(classItems).join(', '))
  if (g.spellcasting?.stat) pushFact(result, 'Заклинатель', STAT_SHORT[g.spellcasting.stat] || g.spellcasting.stat)
  pushFact(result, 'Снаряжение', formatEquipment(classEquipment.value))
  const selectedSpells = spellPool.value.filter((spell) => state.spellIds.includes(spell.id)).map((spell) => spell.name)
  pushFact(result, 'Заклинания', [...new Set([...grantedSpellList.value.map((spell) => spell.name), ...selectedSpells])].join(', '))
  return result
})
</script>

<style scoped>
.result {
  display: flex; flex-direction: column; gap: 14px;
  margin-top: 10px; padding: 15px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
  border-radius: var(--r-lg);
}
.result-head { display: flex; align-items: center; gap: 10px; }
.result-head > span:last-child { display: flex; flex-direction: column; gap: 1px; }
.result-icon {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.result-icon svg { width: 16px; height: 16px; }
.result-title { font-size: 13px; font-weight: 700; color: var(--text-1); }
.result-note { font-size: 11px; color: var(--text-muted); }
.result-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.result-fact {
  min-width: 0; padding: 9px 10px;
  background: color-mix(in srgb, var(--surface-raised) 78%, transparent);
  border-radius: var(--r-md);
}
.result-label { display: block; margin-bottom: 3px; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
.result-value { display: block; font-size: 12px; line-height: 1.4; color: var(--text-1); }
.result-abilities { display: flex; flex-direction: column; gap: 6px; }
.ability-list { display: flex; flex-direction: column; gap: 5px; }
.ability { background: color-mix(in srgb, var(--surface-raised) 78%, transparent); border-radius: var(--r-md); overflow: hidden; }
.ability summary {
  display: flex; align-items: center; gap: 7px; padding: 8px 10px;
  list-style: none; cursor: pointer; color: var(--text-1); font-size: 12px; font-weight: 600;
}
.ability summary::-webkit-details-marker { display: none; }
.ability-static { display: flex; align-items: center; gap: 7px; padding: 8px 10px; color: var(--text-1); font-size: 12px; font-weight: 600; }
.ability-static small { color: var(--accent-soft); font-size: 11px; font-weight: 500; }
.ability summary small { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--accent-soft); font-size: 11px; font-weight: 500; }
.ability summary svg { flex-shrink: 0; width: 13px; height: 13px; margin-left: auto; color: var(--text-muted); transition: transform .15s; }
.ability[open] summary svg { transform: rotate(90deg); }
.ability-desc { padding: 0 10px 10px; color: var(--text-2); font-size: 12px; line-height: 1.45; }

@media (max-width: 640px) {
  .result-facts { grid-template-columns: 1fr; }
}
</style>
