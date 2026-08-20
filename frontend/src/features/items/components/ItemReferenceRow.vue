<template>
  <button
    type="button"
    class="item-reference"
    :class="{ 'item-reference--selected': selected, 'item-reference--disabled': disabled }"
    :disabled="disabled"
    @click="$emit('activate', item)"
  >
    <ItemIcon :item="item" :type="type" :size="34" placeholder />
    <span class="item-reference-main">
      <span class="item-reference-name">{{ item.name }}</span>
      <span v-if="metaLabel" class="item-reference-meta">{{ metaLabel }}</span>
    </span>
    <span v-if="firstAttack" class="item-reference-damage">
      <WeaponDamageMetric :attack="firstAttack" :size="30" />
    </span>
    <span v-if="count > 1" class="item-reference-count">×{{ count }}</span>
    <slot name="trailing">
      <span v-if="costLabel" class="item-reference-cost">{{ costLabel }}</span>
    </slot>
    <ChevronRight v-if="showChevron" :size="16" class="item-reference-chevron" aria-hidden="true" />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import WeaponDamageMetric from '@/features/items/components/WeaponDamageMetric.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  count: { type: Number, default: 1 },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  showChevron: { type: Boolean, default: true },
})

defineEmits(['activate'])

const data = computed(() => props.item.data || {})
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const firstAttack = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks[0] : null)
const metaLabel = computed(() => [
  data.value.weight != null ? `${String(data.value.weight).replace('.', ',')} фнт.` : '',
  data.value.equipment_category === 'pack' ? 'Набор' : '',
].filter(Boolean).join(' · '))
</script>

<style scoped>
.item-reference {
  width: 100%; min-width: 0; display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1px solid var(--border); border-radius: var(--r-md);
  background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-1);
  font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s, transform .15s;
}
.item-reference:hover:not(:disabled) { border-color: color-mix(in srgb, var(--accent) 48%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); transform: translateY(-1px); }
.item-reference--selected { border-color: color-mix(in srgb, var(--accent) 48%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.item-reference--disabled { opacity: .5; cursor: not-allowed; }
.item-reference-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-reference-name { overflow: hidden; color: var(--text-1); font-size: 13px; font-weight: 650; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.item-reference-meta { color: var(--text-muted); font-size: 10px; line-height: 1.2; }
.item-reference-damage { width: clamp(64px, 7vw, 80px); flex: none; display: grid; place-items: center; align-self: stretch; }
.item-reference-count { flex: none; min-width: 30px; color: var(--accent-soft); font-size: 12px; font-weight: 800; text-align: right; }
.item-reference-cost { flex: none; color: var(--warning); font-size: 11px; font-weight: 700; white-space: nowrap; }
.item-reference-chevron { flex: none; color: var(--text-muted); }
</style>
