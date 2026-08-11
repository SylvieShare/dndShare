<template>
  <div class="hit-dice">
    <div class="dice-type" :class="{ 'dice-clickable': charCtx.ownerMode }" @click="charCtx.ownerMode && cycleDice()">
      <SystemDie :sides="data.dice || 'd8'" :size="48" />
    </div>
    <div class="dice-divider"></div>
    <div class="dice-count-row">
      <EditableDiv
        class="dice-count"
        :v="data.count"
        :checkerV="countRx"
        :defaultV="1"
        :readonly="!charCtx.ownerMode"
        @update:v="v => emit({ count: v === '' ? v : parseInt(v) })"
        @change:v="v => emit({ count: parseInt(v) || 1 })"
      />
      <span class="dice-count-label">шт</span>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import EditableDiv from "@/shared/ui/EditableDiv"
import SystemDie from '@/shared/ui/SystemDie.vue'
import { HIT_DICE } from '@/shared/lib/systemDice'

const DICE = HIT_DICE.map((die) => die.value)

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true, dictionaries: {}, var: {} })
const countRx = /^\d{0,2}$/
const data = computed(() => ({ dice: 'd8', count: 1, ...props.value }))

function emitPatch(patch) {
  emit('update:value', props.block.id, { ...data.value, ...patch })
}

function cycleDice() {
  const idx = DICE.indexOf(data.value.dice || 'd8')
  emitPatch({ dice: DICE[(idx + 1) % DICE.length] })
}
</script>

<style scoped>
.hit-dice {
  width: 100px;
  height: 100px;
  background-color: var(--surface-raised);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  user-select: none;
}

.dice-type {
  font-size: 34px;
  font-weight: bold;
  line-height: 1;
  border-radius: 8px;
  padding: 0 6px 2px;
  letter-spacing: -1px;
}

.dice-type.dice-clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.dice-type.dice-clickable:hover {
  background-color: var(--border);
}

.dice-divider {
  width: 44px;
  height: 1px;
  background-color: var(--border-strong);
}

.dice-count-row {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.dice-count {
  color: var(--text-2);
  font-size: 20px;
  font-weight: bold;
  min-width: 16px;
  text-align: center;
  line-height: 1;
}

.dice-count-label {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
