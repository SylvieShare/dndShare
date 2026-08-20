<template>
  <div
    class="item-reference"
    :class="{
      'item-reference--selected': selected,
      'item-reference--disabled': disabled,
      'item-reference--roomy-weapon': roomyWeapon && firstAttack,
    }"
  >
    <button
      type="button"
      class="item-reference-body"
      :disabled="disabled || !activatable"
      @click="$emit('activate', item)"
    >
      <ItemIcon class="item-reference-icon" :item="item" :type="type" :size="roomyWeapon && firstAttack ? 64 : 34" placeholder />
      <span class="item-reference-info">
        <span class="item-reference-main">
          <span class="item-reference-name">{{ item.name }}</span>
          <span v-if="metaLabel" class="item-reference-meta">{{ metaLabel }}</span>
        </span>
        <span v-if="firstAttack" class="item-reference-weapon-details">
          <span class="item-reference-damage">
            <WeaponDamageMetric :attack="firstAttack" :size="30" :layout="roomyWeapon ? 'row' : 'column'" />
          </span>
          <span class="item-reference-properties">
            <small>Свойства</small>
            <span>{{ weaponPropertiesLabel || '—' }}</span>
          </span>
        </span>
      </span>
      <span v-if="count > 1" class="item-reference-count">×{{ count }}</span>
      <slot name="trailing">
        <span v-if="costLabel" class="item-reference-cost">{{ costLabel }}</span>
      </slot>
      <ChevronRight v-if="showChevron && !showDetails" :size="16" class="item-reference-chevron" aria-hidden="true" />
    </button>
    <button
      v-if="showDetails"
      type="button"
      class="item-reference-details"
      :disabled="disabled"
      title="Открыть в справочнике"
      :aria-label="`Открыть «${item.name}» в справочнике`"
      @click.stop="$emit('details', item)"
    >
      <CircleHelp :size="17" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ChevronRight, CircleHelp } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import WeaponDamageMetric from '@/features/items/components/WeaponDamageMetric.vue'
import { useCostFormatter } from '@/features/items/lib/useCostFormatter'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  type: { type: Object, default: null },
  count: { type: Number, default: 1 },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  activatable: { type: Boolean, default: true },
  showChevron: { type: Boolean, default: true },
  showDetails: { type: Boolean, default: false },
  roomyWeapon: { type: Boolean, default: false },
})

defineEmits(['activate', 'details'])

const data = computed(() => props.item.data || {})
const suggestStore = useSuggestStore()
suggestStore.ensure(14)
const { format: formatCost } = useCostFormatter()
const costLabel = computed(() => formatCost(data.value.cost))
const firstAttack = computed(() => Array.isArray(data.value.attacks) ? data.value.attacks[0] : null)
const weaponPropertiesLabel = computed(() => {
  const labels = new Map(suggestStore.items(14).map((entry) => [String(entry.id), entry.value]))
  return (Array.isArray(data.value.tags) ? data.value.tags : [])
    .map((id) => labels.get(String(id)))
    .filter(Boolean)
    .join(', ')
})
const metaLabel = computed(() => [
  data.value.weight != null ? `${String(data.value.weight).replace('.', ',')} фнт.` : '',
  data.value.equipment_category === 'pack' ? 'Набор' : '',
].filter(Boolean).join(' · '))
</script>

<style scoped>
.item-reference {
  width: 100%; min-width: 0; display: flex; align-items: center; gap: 10px;
  border: 1px solid var(--border); border-radius: var(--r-md);
  background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-1);
  transition: border-color .15s, background .15s, transform .15s;
}
.item-reference:hover:not(.item-reference--disabled) { border-color: color-mix(in srgb, var(--accent) 48%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); transform: translateY(-1px); }
.item-reference--selected { border-color: color-mix(in srgb, var(--accent) 48%, var(--border)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.item-reference--disabled { opacity: .5; }
.item-reference-body { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; align-self: stretch; padding: 9px 0 9px 10px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.item-reference-body:disabled { cursor: default; }
.item-reference-info, .item-reference-weapon-details { display: contents; }
.item-reference-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-reference-name { overflow: hidden; color: var(--text-1); font-size: 13px; font-weight: 650; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.item-reference-meta { color: var(--text-muted); font-size: 10px; line-height: 1.2; }
.item-reference-damage { width: clamp(46px, 5vw, 58px); flex: none; display: grid; place-items: center; align-self: stretch; }
.item-reference-properties { width: clamp(72px, 9vw, 118px); min-width: 0; flex: none; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 2px; color: var(--text-2); font-size: 9px; line-height: 1.2; text-align: right; }
.item-reference-properties small { color: var(--text-muted); font-size: 7px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.item-reference-properties > span { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.item-reference-count { flex: none; min-width: 30px; color: var(--accent-soft); font-size: 12px; font-weight: 800; text-align: right; }
.item-reference-cost { flex: none; color: var(--warning); font-size: 11px; font-weight: 700; white-space: nowrap; }
.item-reference-chevron { flex: none; color: var(--text-muted); }
.item-reference-details { width: 30px; height: 30px; flex: none; display: grid; place-items: center; margin-right: 8px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--text-muted); cursor: pointer; transition: color .15s, background .15s; }
.item-reference-details:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
.item-reference-details:disabled { cursor: default; }
.item-reference--roomy-weapon .item-reference-body { min-height: 96px; align-items: center; gap: 14px; padding: 12px 0 12px 12px; }
.item-reference--roomy-weapon .item-reference-info { min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 7px; align-self: stretch; }
.item-reference--roomy-weapon .item-reference-main { flex: none; }
.item-reference--roomy-weapon .item-reference-name { font-size: 14px; line-height: 1.3; }
.item-reference--roomy-weapon .item-reference-weapon-details { display: flex; flex-direction: column; align-items: stretch; gap: 5px; }
.item-reference--roomy-weapon .item-reference-damage { width: auto; display: flex; place-items: unset; align-self: auto; }
.item-reference--roomy-weapon .item-reference-properties { width: auto; display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: baseline; justify-content: initial; gap: 8px; font-size: 10px; line-height: 1.35; text-align: left; }
.item-reference--roomy-weapon .item-reference-properties > span { display: block; overflow: visible; }
.item-reference--roomy-weapon .item-reference-details { width: 34px; height: 34px; }
@media (max-width: 420px) {
  .item-reference--roomy-weapon .item-reference-body { gap: 11px; padding-left: 10px; }
  .item-reference--roomy-weapon .item-reference-properties { grid-template-columns: 52px minmax(0, 1fr); }
}
</style>
