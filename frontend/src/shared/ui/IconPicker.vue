<template>
  <div class="ip">
    <div class="ip-grid">
      <button
        v-for="ic in COUNTER_ICONS"
        :key="ic.name"
        type="button"
        class="ip-ico"
        :class="{ 'ip-ico--sel': ic.name === modelValue }"
        :title="ic.name"
        @click="$emit('update:modelValue', ic.name)"
      >
        <component :is="ic.comp" :size="18" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { COUNTER_ICONS } from '@/shared/ui/icons/counterIcons'

defineProps({ modelValue: { type: String, default: '' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.ip { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

.ip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 168px;
  overflow-y: auto;
  padding: 1px;
}

.ip-ico {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text-2);
  cursor: pointer;
  transition: color 0.12s, background 0.12s, border-color 0.12s;
}
.ip-ico:hover { background: var(--surface-active); color: var(--text-1); }
.ip-ico--sel {
  border-color: var(--accent);
  color: var(--text-on-accent);
  background: color-mix(in srgb, var(--accent) 24%, var(--surface-raised));
}

</style>
