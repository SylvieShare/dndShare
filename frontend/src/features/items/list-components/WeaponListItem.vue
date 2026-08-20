<template>
  <ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null">
    <template v-if="firstAttack" #metric>
      <WeaponDamageMetric :attack="firstAttack" :size="36" />
    </template>
    <template v-if="damageType || tagItems.length" #subtitle>
      <span v-if="damageType">{{ damageType }}</span>
      <template v-for="(tag, tagIndex) in tagItems" :key="tag.id">
        <span v-if="damageType || tagIndex > 0" class="wli-separator"> · </span>
        <span
          class="wli-property"
          :class="{ 'wli-property--described': tag.desc }"
          :tabindex="tag.desc ? 0 : -1"
          @mouseenter="showTagTooltip($event, tag)"
          @mouseleave="hideTagTooltip"
          @focus="showTagTooltip($event, tag)"
          @blur="hideTagTooltip"
        >{{ tag.label }}</span>
      </template>
      <ItemTooltip
        v-if="tooltip.visible"
        :title="tooltip.title"
        :desc="tooltip.desc"
        :x="tooltip.x"
        :top="tooltip.top"
        :bottom="tooltip.bottom"
      />
    </template>
    <template v-if="costLabel" #trailing><span class="wli-cost">{{ costLabel }}</span></template>
  </ObjectListItem>
</template>

<script setup>
import { computed, ref } from 'vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem'
import WeaponDamageMetric from '@/features/items/components/WeaponDamageMetric.vue'
import { useSchemaSuggests } from '@/features/handbook/objects/lib/useSchemaSuggests'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
})

const { suggestItems } = useSchemaSuggests(() => props.type)

const damageTypeMap = computed(() => Object.fromEntries(suggestItems('type').map(s => [s.id, s.value])))
const tagMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s.value])))
const tagDetailsMap = computed(() => Object.fromEntries(suggestItems('tags').map(s => [s.id, s])))

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const firstAttack = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks[0] : null)

const damageType = computed(() => firstAttack.value
  ? (damageTypeMap.value[firstAttack.value.type] || firstAttack.value.type || '')
  : '')

const tagItems = computed(() =>
  (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map((id) => {
      if (id && typeof id === 'object') {
        return {
          id: id.id ?? id.value,
          label: id.value || id.label || id.name || String(id.id ?? ''),
          desc: id.desc || '',
        }
      }
      const details = tagDetailsMap.value[id] || {}
      return { id, label: details.value || tagMap.value[id] || String(id), desc: details.desc || '' }
    })
    .filter((tag) => tag.label)
)

const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

function showTagTooltip(event, tag) {
  if (!tag.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const placeAbove = window.innerHeight - rect.bottom < 220
  tooltip.value = {
    visible: true,
    title: tag.label,
    desc: tag.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: placeAbove ? null : rect.bottom + 8,
    bottom: placeAbove ? window.innerHeight - rect.top + 8 : null,
  }
}

function hideTagTooltip() { tooltip.value.visible = false }

</script>

<style scoped>
.wli-cost { color: var(--text-2); font-size: 11px; white-space: nowrap; }
.wli-separator { color: var(--text-muted); }
.wli-property--described { border-bottom: 1px dotted color-mix(in srgb, var(--accent) 65%, transparent); cursor: help; outline: none; }
.wli-property--described:focus { color: var(--accent-soft); border-bottom-color: var(--accent); }

</style>
