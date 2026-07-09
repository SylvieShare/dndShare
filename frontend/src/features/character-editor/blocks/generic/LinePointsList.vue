<template>
  <div class="lp-list">
    <div class="lp-row" v-for="(row, i) in rows" :key="i">
      <input
        v-if="charCtx.editMode"
        class="lp-name-input"
        :value="row.name"
        placeholder="—"
        @input="updateName(i, $event.target.value)"
      />
      <span v-else class="lp-name-static">{{ row.name || '—' }}</span>
      <div class="lp-dots">
        <span
          v-for="d in block.content.max"
          :key="d"
          class="dot"
          :class="{ filled: d <= row.value, clickable: charCtx.editMode }"
          @click="charCtx.editMode && toggleDot(i, d)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { editMode: true, ownerMode: false, dictionaries: {}, var: {} })
const rows = computed(() => {
  const count = props.block.content.rows
  const saved = props.value || []
  return Array.from({ length: count }, (_, i) => saved[i] || { name: '', value: 0 })
})

function updateName(i, name) {
  const r = [...rows.value]
  r[i] = { ...r[i], name }
  emit('update:value', props.block.id, r)
}

function toggleDot(i, d) {
  const r = [...rows.value]
  r[i] = { ...r[i], value: d === r[i].value ? d - 1 : d }
  emit('update:value', props.block.id, r)
}
</script>

<style scoped>
.lp-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.lp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lp-name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid #2e2e2e;
  color: var(--text-1, var(--text-2));
  font-size: 13px;
  padding: 2px 2px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}

.lp-name-input:focus {
  border-bottom-color: #6a3fcb;
}

.lp-name-static {
  flex: 1;
  font-size: 13px;
  color: var(--text-1, var(--text-2));
}

.lp-dots {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #484848;
  background: transparent;
  transition: background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}

.dot.filled {
  background: #c8a04a;
  border-color: #c8a04a;
}

.dot.clickable { cursor: pointer; }

.dot.clickable:hover {
  border-color: #c8a04a;
}
</style>
