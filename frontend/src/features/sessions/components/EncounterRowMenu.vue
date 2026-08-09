<template>
  <RowActionMenu class="enc-row-menu">
    <template #default="{ close }">
      <button
        v-if="statesBlock"
        type="button"
        class="ram-item"
        @click="$emit('edit-states'); close()"
      >Изменить статусы</button>
      <button
        v-if="isNpc"
        type="button"
        class="ram-item"
        @click="$emit('edit-note'); close()"
      >Изменить заметку</button>
      <div v-if="isNpc" class="ram-clone">
        <span class="ram-clone-label">Копировать</span>
        <input
          v-model.number="cloneCount"
          class="ram-clone-input"
          type="number"
          min="1"
          max="20"
          @click.stop
        />
        <button
          type="button"
          class="ram-clone-btn"
          @click="enc.cloneNpc(combatant, cloneCount); close()"
        >×{{ cloneCount || 1 }}</button>
      </div>
      <div class="ram-label">{{ isNpc ? 'Цвет рамки' : 'Цвет плитки' }}</div>
      <div class="ram-colors">
        <ColorPresetPicker
          inline
          allow-clear
          :model-value="combatant.iconColor || ''"
          @update:model-value="color => enc.setIconColor(combatant, color)"
        />
      </div>
      <button
        v-if="canRevive"
        type="button"
        class="ram-item"
        @click="enc.reviveCombatant(combatant); close()"
      >Воскресить</button>
      <button
        v-if="canDelete"
        type="button"
        class="ram-item ram-item--danger"
        @click="enc.removeNpc(combatant); close()"
      >Удалить</button>
    </template>
  </RowActionMenu>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'

const props = defineProps({
  combatant:   { type: Object, required: true },
  section:     { type: String, required: true },
  statesBlock: { type: Object, default: null },
})
defineEmits(['edit-states', 'edit-note'])

const enc = inject('encounter')

const isNpc = computed(() => props.combatant.type === 'npc')
const canDelete = computed(() => isNpc.value && (props.section === 'reserve-npc' || props.section === 'dead'))
const canRevive = computed(() => props.section === 'dead')

const cloneCount = ref(1)
</script>

<style scoped>
.enc-row-menu { flex-shrink: 0; }

.ram-clone {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
}
.ram-clone-label {
  font-size: 12px;
  color: var(--text-2);
  flex: 1;
}
.ram-clone-input {
  width: 44px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 3px 6px;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-1);
  outline: none;
  -moz-appearance: textfield;
}
.ram-clone-input::-webkit-outer-spin-button,
.ram-clone-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ram-clone-input:focus { border-color: var(--accent); }
.ram-clone-btn {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 5px;
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.ram-clone-btn:hover {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
}
</style>
