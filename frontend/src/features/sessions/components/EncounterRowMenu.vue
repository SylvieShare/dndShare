<template>
  <RowActionMenu ref="menuRef" :trigger-attrs="{ style: { flexShrink: 0 } }">
    <template #default="{ close }">
      <EncounterInitiativeMenu v-if="!enc.encounter.active && section !== 'dead'" :combatant="combatant" :encounter="enc" />
      <RowActionItem
        v-if="canOpenCard"
        :icon="BookOpen"
        @click="enc.openNpcDetail(combatant); close()"
      >Открыть карточку</RowActionItem>
      <RowActionItem
        v-if="statesBlock"
        :icon="Activity"
        @click="$emit('edit-states'); close()"
      >Состояния</RowActionItem>
      <RowActionItem v-if="isNpc" :icon="History" @click="historyOpen = true; close()">История урона и эффектов</RowActionItem>
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
            <FormField label="Количество копий" vertical>
              <FormNumberInput :value="cloneCount" :min="1" :max="20" @change="cloneCount = $event" />
            </FormField>
            <ActionButton @click="cloneNpc(closeClone, close)">Создать ×{{ cloneCount || 1 }}</ActionButton>
          </div>
        </template>
      </RowActionSubmenu>
      <RowActionItem
        v-if="canRevive"
        action="revive"
        @click="enc.requestRevive(combatant); close()"
      >Воскресить</RowActionItem>
      <RowActionItem
        v-if="canDelete"
        action="delete"
        tone="danger"
        @click="enc.removeNpc(combatant); close()"
      >Удалить</RowActionItem>
    </template>
  </RowActionMenu>
  <NpcImpactHistory v-if="historyOpen" :uid="combatant.uid" @close="historyOpen = false" />
</template>

<script setup>
import { computed, defineAsyncComponent, inject, ref } from 'vue'
import { Activity, Archive, BookOpen, Copy, Dices, History } from '@lucide/vue'
import EncounterInitiativeMenu from './EncounterInitiativeMenu.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { ActionButton, FormField, FormNumberInput, RowActionMenu } from '@sylvieshare/share-ui'
import { RowActionSubmenu } from '@sylvieshare/share-ui'

const NpcImpactHistory = defineAsyncComponent(() => import('./NpcImpactHistory.vue'))
const historyOpen = ref(false)
const props = defineProps({
  combatant:   { type: Object, required: true },
  section:     { type: String, required: true },
  statesBlock: { type: Object, default: null },
})
defineEmits(['edit-states', 'edit-note'])

const enc = inject('encounter')

const isNpc = computed(() => props.combatant.type === 'npc')
const canOpenCard = computed(() => isNpc.value && props.combatant.itemId != null)
const canReserve = computed(() => props.section === 'combat')
const canRerollHp = computed(() =>
  isNpc.value && props.section !== 'combat' && !!enc.npcHpFormula(props.combatant)
)
const canDelete = computed(() => isNpc.value)
const canRevive = computed(() => props.section === 'dead' && enc.canEditPlayerHp())

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

.ram-clone-form {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 2px;
}
</style>
