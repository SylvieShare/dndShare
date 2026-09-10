<template>
  <div class="background-detail">
    <DetailSection v-if="data.description" label="Предыстория"><template #icon><BookOpen /></template><RichContent :html="data.description" /></DetailSection>
    <DetailSection v-if="data.feature || data.feature_desc" :label="data.feature || 'Особенность'"><template #icon><Sparkles /></template><RichContent v-if="data.feature_desc" :html="data.feature_desc" /></DetailSection>
    <DetailSection v-if="proficiencies.length || data.lang_choice?.count" label="Владения и языки">
      <template #icon><GraduationCap /></template>
      <dl class="background-facts"><template v-for="group in proficiencies" :key="group.label"><dt>{{ group.label }}</dt><dd>{{ group.values.join(', ') }}</dd></template><template v-if="data.lang_choice?.count"><dt>Языки на выбор</dt><dd>{{ data.lang_choice.count }}</dd></template></dl>
    </DetailSection>
    <DetailSection v-if="equipment.length || coins" label="Стартовое снаряжение">
      <template #icon><Backpack /></template>
      <div class="background-items"><ItemReferenceRow v-for="(row, index) in equipment" :key="`${row.item.id}-${index}`" :item="row.item" :count="row.count" :params="row.params || {}" @activate="preview = row.item" /></div>
      <p v-if="coins">{{ coins }}</p>
    </DetailSection>
    <DetailSection v-for="(choice, index) in choices" :key="choice.key || index" :label="choice.label || 'Снаряжение на выбор'">
      <template #icon><ListChecks /></template>
      <p class="background-choice-note">Выберите один вариант<template v-if="choice.grants_tool_proficiency"> · даёт владение инструментом</template><template v-if="replacement(choice)"> · вместо {{ replacement(choice) }}</template>.</p>
      <div class="background-items"><ItemReferenceRow v-for="id in choice.option_item_ids || []" :key="id" :item="itemById(id)" @activate="preview = itemById(id)" /></div>
    </DetailSection>
    <p v-if="loadError" role="alert">{{ loadError }} <AddButton label="Повторить" @click="loadReferences" /></p>
    <ItemViewModal v-if="preview" :item="preview.data ? preview : null" :item-id="preview.id" :item-type-id="preview.typeId" @close="preview = null" />
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { AddButton } from '@sylvieshare/share-ui'
import { Backpack, BookOpen, GraduationCap, ListChecks, Sparkles } from '@lucide/vue'
import { useSuggestStore } from '@/stores/suggest'
import { itemsApi } from '@/shared/api/itemsApi'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import ItemReferenceRow from '../components/ItemReferenceRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
const props = defineProps({ item: Object })
const data = computed(() => props.item.data || {})
const store = useSuggestStore(), items = ref([]), preview = ref(null), loadError = ref('')
const choices = computed(() => data.value.item_choices || [])
const equipmentRows = computed(() => {
  const rows = [...(data.value.equipment_items || [])]
  for (const row of data.value.tool_items || []) if (!rows.some(r => Number(r.item_id) === Number(row.item_id))) rows.push(row)
  return rows
})
const referenceIds = computed(() => [...new Set([...equipmentRows.value.map(r => r.item_id), ...choices.value.flatMap(c => [...(c.option_item_ids || []), c.replace_tool_item_id, c.replace_equipment_item_id])].map(Number).filter(n => n > 0))])
const itemById = id => items.value.find(i => Number(i.id) === Number(id)) || { id: Number(id), name: 'Запись справочника недоступна', typeId: 2 }
const equipment = computed(() => equipmentRows.value.map(row => ({ ...row, item: itemById(row.item_id), count: Math.max(1, Number(row.count) || 1) })))
const label = (type, id) => store.items(type).find(s => Number(s.id) === Number(id))?.value || 'Загрузка…'
const proficiencies = computed(() => [['skills', 15, 'Навыки'], ['languages', 6, 'Языки'], ['tool_prof', 5, 'Инструменты']].map(([key, type, title]) => ({ label: title, values: (data.value[key] || []).map(id => label(type, id)) })).filter(g => g.values.length))
const coins = computed(() => (data.value.starting_coins || []).filter(c => c.amount > 0).map(c => `${c.amount} ${label(17, c.currency_id)}`).join(' · '))
function replacement(choice) { const id = choice.replace_equipment_item_id || choice.replace_tool_item_id; return id ? itemById(id).name : choice.replace_tool_prof_id ? label(5, choice.replace_tool_prof_id) : '' }
let request = 0
async function loadReferences() {
  const version = ++request; loadError.value = ''
  try { const result = referenceIds.value.length ? await itemsApi.byIds(referenceIds.value) : { items: [] }; if (version === request) items.value = result.items || [] }
  catch { if (version === request) loadError.value = 'Не удалось загрузить снаряжение.' }
}
watch(referenceIds, loadReferences, { immediate: true })
for (const id of [15, 6, 5, 17]) store.ensure(id).catch(() => {})
</script>
<style scoped>
.background-detail { display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.6; }
.background-facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 16px; margin: 0; }
.background-facts dt, .background-choice-note { color: var(--text-muted); font-size: 12px; }
.background-facts dd { margin: 0; color: var(--text-1); }
.background-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 640px) { .background-items { grid-template-columns: 1fr; } }
</style>
