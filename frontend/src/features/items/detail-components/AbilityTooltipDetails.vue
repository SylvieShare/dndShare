<template>
  <template v-if="hasDetails">
    <span v-if="data.max_use" class="atd-uses">{{ data.max_use }} исп.</span>
    <span v-if="data.rollback_short_rest" class="atd-badge atd-sr">КО</span>
    <span v-if="data.rollback_long_rest" class="atd-badge atd-lr">ДО</span>
  </template>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
})

const data = computed(() => props.item.data || {})
const hasDetails = computed(() => data.value.max_use || data.value.rollback_short_rest || data.value.rollback_long_rest)
</script>

<style scoped>
.atd-uses {
  font-size: 11px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 4px;
  padding: 2px 7px;
}

.atd-badge {
  font-size: 9px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
}
.atd-sr { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.atd-lr { background: color-mix(in srgb, var(--info) 15%, transparent); color: var(--info); }
</style>
