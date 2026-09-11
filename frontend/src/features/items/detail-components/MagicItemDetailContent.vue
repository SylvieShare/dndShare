<template>
  <div class="magic-item-detail">
    <ItemDetailContent :item="item" :show-title="false" :economy-in-header="economyInHeader" />
    <DetailSection v-for="kind in kinds.filter(kind => !selectedBases.some(base => base.kind === kind))" :key="kind" :label="kind === 'weapon' ? 'Подходящее оружие' : 'Подходящие доспехи и щиты'">
      <p>Основа определяет обычные характеристики. Выберите её при добавлении предмета персонажу.</p>
      <MagicEquipmentBases :item="item" :kind="kind" />
    </DetailSection>
    <MagicEquipmentAdditions v-for="kind in kinds" :key="`${kind}-additions`" :item="item" :kind="kind" />
    <DetailSection v-if="data.status_effects?.length" label="Накладываемые эффекты"><ItemEffectLinks :item="item" :z-index="nestedViewZIndex" /></DetailSection>
    <ItemTreasureSummary v-if="!selectedBases.length" :treasure="data.treasure" />
    <p v-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="hydrate">Повторить</ActionButton></p>
    <DetailSection v-for="field in details" :key="field.key" :label="field.name">
      <MagicRuleFields headless :fields="[field]" :data="data" :items="references" :labels="labels" />
    </DetailSection>
  </div>
</template>
<script setup>
import ItemEffectLinks from '@/features/items/components/ItemEffectLinks.vue'
import { computed, ref, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import DetailSection from '@/shared/ui/DetailSection.vue'
import ItemDetailContent from './ItemDetailContent.vue'
import MagicRuleFields from './MagicRuleFields.vue'
import MagicEquipmentAdditions from './MagicEquipmentAdditions.vue'
import ItemTreasureSummary from './ItemTreasureSummary.vue'
import MagicEquipmentBases from '@/features/items/components/MagicEquipmentBases.vue'
import { selectedMagicBases } from '@/features/items/lib/magicItemInstanceView'
import { magicEquipmentKinds } from '@/features/items/lib/magicEquipmentBases'
import { itemsApi } from '@/shared/api/itemsApi'
import { collectSuggestIds } from '@/features/handbook/objects/lib/schemaFields'
import { useSuggestStore } from '@/stores/suggest'
const props = defineProps({ item: Object, type: Object, economyInHeader: Boolean, instance: Object, nestedViewZIndex: { type: Number, default: 5100 } })
const data = computed(() => props.item.data || {})
const selectedBases = computed(() => selectedMagicBases(props.item, props.instance))
const kinds = computed(() => magicEquipmentKinds(props.item))
// Each remaining schema field is rendered, including newly added mechanics. These
// fields already have a dedicated presentation in the cover, body or base list.
const dedicated = new Set(['dawn_recovery', 'status_effects', 'desc', 'cost', 'weight', 'contents', 'is_container', 'consumable', 'type', 'rarity', 'attunement', 'attunement_requirement', 'activation', 'weapon', 'armor_base', 'resource_color', 'treasure'])
const details = computed(() => (props.type?.fields || []).filter(f => !dedicated.has(f.key) && !(f.key === 'weapon_damage' && data.value.weapon) && present(data.value[f.key])))
function present(v) { return v != null && v !== '' && v !== false && (!Array.isArray(v) || v.length > 0) && (typeof v !== 'object' || Object.keys(v).length > 0) }
const suggest = useSuggestStore(), references = ref({}), error = ref(''), labels = ref({})
let sequence = 0
async function hydrate() {
  const seq = ++sequence, ids = new Set(), names = {}
  error.value = ''; references.value = {}
  function walk(fields, values) {
    if (!values) return
    for (const field of fields || []) {
      const v = values[field.key]
      if (v == null) continue
      if (field.type === 'item') ids.add(Number(v?.id ?? v))
      if (field.type === 'item_array') v.forEach(id => ids.add(Number(id?.id ?? id)))
      if (field.type === 'object') walk(field.fields, v)
      if (field.type === 'object_array') v.forEach(row => { if (row.key && (row.title || row.name || row.label)) names[row.key] = row.title || row.name || row.label; walk(field.fields, row) })
    }
  }
  walk(props.type?.fields, data.value); labels.value = names
  try {
    const [result] = await Promise.all([ids.size ? itemsApi.byIds([...ids]) : { items: [] }, ...[...collectSuggestIds(props.type?.fields || [])].map(id => suggest.ensure(id))])
    if (seq === sequence) references.value = Object.fromEntries((result.items || []).map(item => [item.id, item]))
  } catch { if (seq === sequence) error.value = 'Не удалось загрузить названия связанных правил.' }
}
watch(() => [props.item, props.type], hydrate, { immediate: true })
</script>
<style scoped>
.magic-item-detail { display: flex; flex-direction: column; gap: 16px; }
.magic-item-detail p { margin: 4px 0 10px; color: var(--text-muted); }
</style>
