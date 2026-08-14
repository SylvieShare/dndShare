<template>
  <div class="enc-row-menu">
  <RowActionMenu ref="menuRef">
    <template #default="{ close }">
      <RowActionItem
        v-if="statesBlock"
        :icon="Activity"
        @click="$emit('edit-states'); close()"
      >Состояния</RowActionItem>
      <RowActionItem
        v-if="canReserve"
        :icon="Archive"
        @click="enc.sendToReserve(combatant); close()"
      >В запас</RowActionItem>
      <RowActionItem
        v-if="canRerollHp"
        :icon="Dices"
        @click="enc.rollNpcHpFromFormula(combatant); close()"
      >Перебросить HP</RowActionItem>
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
import { Activity, Archive, Copy, Dices } from '@lucide/vue'
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
const canReserve = computed(() => props.section === 'combat')
const canRerollHp = computed(() =>
  isNpc.value && props.section !== 'combat' && !!enc.npcHpFormula(props.combatant)
)
const canDelete = computed(() => isNpc.value)
const canRevive = computed(() => props.section === 'dead')

const cloneCount = ref(1)
const menuRef = ref(null)

function cloneNpc(closeSubmenu, closeMenu) {
  enc.cloneNpc(props.combatant, cloneCount.value)
  closeSubmenu()
  closeMenu()
}

function toggle(event) {
  menuRef.value?.toggle(event)
}

defineExpose({ toggle })
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
