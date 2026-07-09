<template>
  <div class="blood-pool">
    <div
      class="blood-boxes"
      :style="inRow ? { display: 'grid', gridTemplateColumns: `repeat(${inRow}, 22px)` } : {}"
    >
      <span
        v-for="i in max"
        :key="i"
        class="blood-box"
        :class="{ filled: i <= current }"
        @click="toggle(i)"
      />
    </div>
    <div class="blood-footer">
      <span class="blood-count">{{ current }} / {{ max }}</span>
      <div v-if="charCtx.editMode" class="blood-max-ctrl">
        <button class="ctrl-btn" @click="changeMax(-1)">−</button>
        <span class="ctrl-label">макс</span>
        <button class="ctrl-btn" @click="changeMax(1)">+</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { editMode: true, ownerMode: false, dictionaries: {}, var: {} })
const defaultMax = computed(() => props.block.content.default ?? 10)
const current = computed(() => props.value?.current ?? 0)
const max = computed(() => props.value?.max ?? defaultMax.value)
const inRow = computed(() => props.block.content.in_row ?? null)

function toggle(i) {
  emit('update:value', props.block.id, {
    current: i === current.value ? i - 1 : i,
    max: max.value,
  })
}

function changeMax(delta) {
  const newMax = Math.max(1, max.value + delta)
  emit('update:value', props.block.id, {
    current: Math.min(current.value, newMax),
    max: newMax,
  })
}
</script>

<style scoped>
.blood-pool {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.blood-boxes {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.blood-box {
  width: 22px;
  height: 22px;
  border: 2px solid #5a1a1a;
  border-radius: 3px;
  background: transparent;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.blood-box.filled {
  background: #8b0000;
  border-color: #a00000;
}

.blood-box:hover {
  border-color: #c0392b;
}

.blood-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}

.blood-count {
  font-size: 12px;
  color: var(--text-2, var(--text-muted));
}

.blood-max-ctrl {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ctrl-label {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.ctrl-btn {
  width: 20px;
  height: 20px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 3px;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: border-color 0.12s, color 0.12s;
}

.ctrl-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-1);
}
</style>
