<template>
  <div class="line-points">
    <span class="lp-title">{{ block.content.title }}</span>
    <div class="lp-dots">
      <span
        v-for="i in block.content.max"
        :key="i"
        class="dot"
        :class="{ filled: i <= current, clickable: charCtx.ownerMode }"
        @click="charCtx.ownerMode && toggle(i)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const current = computed(() => props.value ?? 0)

function toggle(i) {
  emit('update:value', props.block.id, i === current.value ? i - 1 : i)
}
</script>

<style scoped>
.line-points {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}

.lp-title {
  flex: 1;
  font-size: 13px;
  color: var(--text-1, var(--text-2));
  white-space: nowrap;
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
  border: 2px solid var(--surface-active);
  background: transparent;
  transition: background 0.12s, border-color 0.12s;
  flex-shrink: 0;
}

.dot.filled {
  background: var(--warning);
  border-color: var(--warning);
}

.dot.clickable { cursor: pointer; }

.dot.clickable:hover {
  border-color: var(--warning);
}
</style>
