<template>
  <button
    type="button"
    class="subclass-tile"
    :class="{ 'subclass-tile--selected': selected }"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="subclass-tile-icon" aria-hidden="true">
      <ItemIcon v-if="item.iconImageUrl || item.svg" :item="item" :size="46" />
      <span v-else class="subclass-tile-monogram">{{ monogram }}</span>
    </span>

    <span class="subclass-tile-copy">
      <span class="subclass-tile-heading">
        <strong>{{ item.name }}</strong>
        <span v-if="selected" class="subclass-tile-status">
          <Check :size="13" aria-hidden="true" /> Выбрано
        </span>
      </span>
      <span v-if="description" class="subclass-tile-description">{{ description }}</span>
      <span v-if="benefits.length" class="subclass-tile-benefits">
        <span class="subclass-tile-benefits-label">Даёт</span>
        <span class="subclass-tile-benefits-list">
          <span v-for="benefit in benefits" :key="benefit.name" :title="benefit.description || null">
            {{ benefit.name }}
          </span>
        </span>
      </span>
    </span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({
  item: { type: Object, required: true },
  description: { type: String, default: '' },
  benefits: { type: Array, default: () => [] },
  selected: { type: Boolean, default: false },
})
defineEmits(['select'])

const monogram = computed(() => String(props.item?.name || '?').trim().slice(0, 1).toUpperCase())
</script>

<style scoped>
.subclass-tile {
  min-width: 0; width: 100%; display: flex; align-items: flex-start; gap: 13px;
  padding: 14px; border: 1px solid var(--border); border-radius: var(--r-md);
  background: var(--surface); color: inherit; font: inherit; text-align: left; cursor: pointer;
  transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
}
.subclass-tile:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 46%, var(--border)); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
.subclass-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.subclass-tile--selected { border-color: color-mix(in srgb, var(--accent) 70%, var(--border)); background: color-mix(in srgb, var(--accent) 10%, var(--surface)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent); }
.subclass-tile-icon {
  width: 54px; height: 54px; flex: none; display: grid; place-items: center; overflow: hidden;
  border-radius: 50%; background: color-mix(in srgb, var(--accent) 13%, var(--surface-raised)); color: var(--accent);
}
.subclass-tile-monogram { font-family: var(--font-display); font-size: 25px; font-weight: 700; }
.subclass-tile-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 6px; }
.subclass-tile-heading { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.subclass-tile-heading strong { min-width: 0; color: var(--text-1); font-family: var(--font-display); font-size: 17px; line-height: 1.2; }
.subclass-tile-status { flex: none; display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-size: 9px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.subclass-tile-description { display: -webkit-box; overflow: hidden; color: var(--text-2); font-size: 11px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.subclass-tile-benefits { display: flex; align-items: baseline; gap: 7px; margin-top: 2px; }
.subclass-tile-benefits-label { flex: none; color: var(--accent); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.subclass-tile-benefits-list { min-width: 0; display: flex; flex-wrap: wrap; gap: 2px 11px; color: var(--text-1); font-size: 10px; font-weight: 600; line-height: 1.35; }
.subclass-tile-benefits-list > span { position: relative; }
.subclass-tile-benefits-list > span:not(:last-child)::after { content: '·'; position: absolute; left: calc(100% + 5px); color: var(--text-muted); }
@media (max-width: 440px) { .subclass-tile { padding: 12px; } .subclass-tile-icon { width: 46px; height: 46px; } }
</style>
