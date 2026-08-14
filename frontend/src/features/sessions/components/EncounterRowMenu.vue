<template>
  <div class="enc-row-menu">
  <RowActionMenu>
    <template #default="{ close }">
      <RowActionItem
        v-if="statesBlock"
        :icon="Activity"
        @click="$emit('edit-states'); close()"
      >Изменить статусы</RowActionItem>
      <RowActionItem
        v-if="isNpc"
        action="note"
        @click="$emit('edit-note'); close()"
      >Изменить заметку</RowActionItem>
      <RowActionSubmenu v-if="isNpc" label="Количество копий" :min-width="220">
        <template #trigger="{ open }">
          <RowActionItem :icon="Copy" submenu :submenu-open="open">
            Копировать
            <template #suffix>×{{ cloneCount || 1 }}</template>
          </RowActionItem>
        </template>
        <template #default="{ close: closeClone }">
          <div class="ram-clone-form">
            <input
              v-model.number="cloneCount"
              class="ram-clone-input"
              type="number"
              min="1"
              max="20"
              aria-label="Количество копий"
              @click.stop
            />
            <button
              type="button"
              class="ram-clone-btn"
              @click="cloneNpc(closeClone, close)"
            >Создать ×{{ cloneCount || 1 }}</button>
          </div>
        </template>
      </RowActionSubmenu>
      <RowActionSubmenu v-if="!isNpc" label="Цвет плитки">
        <template #trigger="{ open }">
          <RowActionItem :icon="Palette" submenu :submenu-open="open">Изменить цвет</RowActionItem>
        </template>
        <template #default="{ close: closeColor }">
          <ColorPresetPicker
            inline
            allow-clear
            :model-value="combatant.iconColor || ''"
            @update:model-value="color => setIconColor(color, closeColor)"
          />
        </template>
      </RowActionSubmenu>
      <RowActionItem
        v-if="canRevive"
        action="revive"
        @click="enc.reviveCombatant(combatant); close()"
      >Воскресить</RowActionItem>
      <RowActionItem
        v-if="canDelete"
        action="delete"
        tone="danger"
        @click="enc.removeNpc(combatant); close()"
      >Удалить</RowActionItem>
    </template>
  </RowActionMenu>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { Activity, Copy, Palette } from '@lucide/vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'
import RowActionSubmenu from '@/shared/ui/RowActionSubmenu.vue'

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

function cloneNpc(closeSubmenu, closeMenu) {
  enc.cloneNpc(props.combatant, cloneCount.value)
  closeSubmenu()
  closeMenu()
}

function setIconColor(color, close) {
  enc.setIconColor(props.combatant, color)
  close()
}
</script>

<style scoped>
.enc-row-menu { flex-shrink: 0; }

.ram-clone-form {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px;
}
.ram-clone-input {
  width: 54px;
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
  flex: 1;
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
