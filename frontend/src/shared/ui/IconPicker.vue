<template>
  <div class="ip">
    <div class="ip-search">
      <svg class="ip-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        class="ip-search-input"
        :value="q"
        placeholder="Поиск иконки…"
        @input="q = $event.target.value"
      />
    </div>
    <div class="ip-grid">
      <button
        v-for="ic in filtered"
        :key="ic.name"
        type="button"
        class="ip-ico"
        :class="{ 'ip-ico--sel': ic.name === modelValue }"
        :title="ic.name"
        @click="$emit('update:modelValue', ic.name)"
      >
        <component :is="ic.comp" :size="18" :stroke-width="2" />
      </button>
      <div v-if="!filtered.length" class="ip-empty">ничего не найдено</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { COUNTER_ICONS } from '@/shared/ui/icons/counterIcons'

defineProps({ modelValue: { type: String, default: '' } })
defineEmits(['update:modelValue'])

const q = ref('')
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return COUNTER_ICONS
  return COUNTER_ICONS.filter(i => i.kw.includes(s) || i.name.toLowerCase().includes(s))
})
</script>

<style scoped>
.ip { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

.ip-search { position: relative; display: flex; align-items: center; }
.ip-search-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
}
.ip-search-input {
  width: 100%;
  box-sizing: border-box;
  height: 32px;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 0 10px 0 30px;
  outline: none;
  transition: border-color 0.15s;
}
.ip-search-input:focus { border-color: var(--accent); }
.ip-search-input::placeholder { color: var(--text-muted); }

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

.ip-empty { color: var(--text-muted); font-size: 12px; padding: 6px 2px; }
</style>
