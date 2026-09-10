<template>
  <dl class="magic-rule-fields" :class="{ 'magic-rule-headless': headless }">
    <template v-for="field in visible" :key="field.key">
      <dt v-if="!headless" :title="field.hint">{{ field.name }}</dt>
      <dd>
        <RichContent v-if="['description', 'textarea'].includes(field.type) || ['description', 'desc'].includes(field.key)" :html="String(data[field.key])" />
        <MagicRuleFields v-else-if="field.type === 'object'" :fields="field.fields" :data="data[field.key]" :items="items" :labels="labels" />
        <div v-else-if="field.type === 'object_array'" class="magic-rule-rows">
          <MagicRuleFields v-for="(row, index) in data[field.key]" :key="index" :fields="field.fields" :data="row" :items="items" :labels="labels" />
        </div>
        <span v-else>{{ display(field, data[field.key]) }}</span>
      </dd>
    </template>
  </dl>
</template>
<script setup>
import { computed } from 'vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import { useSuggestStore } from '@/stores/suggest'
import { isFieldVisible, getSuggestId } from '@/features/handbook/objects/lib/schemaFields'
const props = defineProps({ fields: Array, data: Object, items: Object, labels: Object, headless: Boolean })
const suggest = useSuggestStore()
const technical = new Set(['key', 'resource_color', 'icon', 'color'])
const visible = computed(() => (props.fields || []).filter(f => !technical.has(f.key) && isFieldVisible(f, props.data) && present(props.data?.[f.key])))
function present(value) { return value != null && value !== '' && (!Array.isArray(value) || value.length) && (typeof value !== 'object' || Object.keys(value).length) }
function display(field, value) {
  if (Array.isArray(value)) return value.map(v => display({ ...field, type: field.type.replace('_array', '') }, v)).join(', ')
  if (['bool', 'boolean'].includes(field.type)) return value ? 'Да' : 'Нет'
  if (field.type === 'item') return props.items?.[value]?.name || `Запись №${value}`
  if (field.type === 'suggest') return suggest.items(getSuggestId(field)).find(v => String(v.id) === String(value))?.value || `Значение №${value}`
  if (field.type === 'select') return field.options?.find(o => String(o.value) === String(value))?.label || value
  if (field.type === 'dice') return String(value).startsWith('d') ? value : `d${value}`
  if (field.type === 'int_by_suggest') return `${value.value} ${suggest.items(getSuggestId(field)).find(v => Number(v.id) === Number(value.suggest_id))?.value || ''}`
  if (field.key.endsWith('_key') || field.key.endsWith('_keys')) return props.labels?.[value] || value
  return typeof value === 'object' ? Object.values(value).join(' · ') : value
}
</script>
<style scoped>
.magic-rule-fields { display: grid; grid-template-columns: minmax(115px, 1fr) minmax(0, 2fr); gap: 5px 12px; margin: 0; line-height: 1.5; }
.magic-rule-headless { grid-template-columns: minmax(0, 1fr); }
dt { color: var(--text-muted); font-size: 12px; }
dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.magic-rule-rows { display: grid; gap: 12px; }
.magic-rule-fields .magic-rule-fields { grid-template-columns: minmax(90px, 1fr) minmax(0, 1.4fr); padding-left: 10px; border-left: 2px solid var(--border); }
@media (max-width: 540px) { .magic-rule-fields, .magic-rule-fields .magic-rule-fields { grid-template-columns: minmax(0, 1fr); } }
</style>
