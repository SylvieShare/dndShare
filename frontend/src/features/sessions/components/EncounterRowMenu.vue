<template>
  <RowActionMenu
    ref="menuRef"
    :anchor="menuAnchor"
    title="Действия существа"
    :trigger-attrs="{ style: { display: 'none' } }"
  >
    <template #default="{ close }">
      <CharacterMenuActions
        :view="canOpenCard || canOpenSheet ? () => openDetails(close) : undefined"
        :view-label="canOpenCard ? 'Открыть карточку' : 'Открыть лист'"
        :view-caption="canOpenCard ? 'Карточка' : 'Лист'"
        :view-icon="BookOpen"
        :edit="isNpc ? () => { close(); emit('edit-note') } : undefined"
        edit-label="Изменить заметку"
        :remove="isNpc ? () => { close(); enc.removeNpc(combatant) } : undefined"
      />
      <EncounterInitiativeMenu v-if="combatant.position !== 'dead'" :combatant="combatant" :encounter="enc" />
      <RowActionItem v-if="canReserve && (!enc.encounter.active || enc.encounter.round === 0)" :icon="Activity" @click="enc.toggleSurprised(combatant); close()">{{ combatant.surprised ? 'Убрать «врасплох»' : 'Застигнут врасплох' }}</RowActionItem>
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
      >{{ enc.encounter.active ? 'Вывести из боя' : 'Убрать со сцены' }}</RowActionItem>
      <RowActionSubmenu v-if="isNpc && section === 'reserve-npc' && enc.reserveTabs.length > 1" label="Выбрать запас">
        <template #trigger="{ open }"><RowActionItem :icon="Archive" submenu :submenu-open="open">Другой запас</RowActionItem></template>
        <template #default="{ close: closeReserves }">
          <RowActionItem v-for="tab in enc.reserveTabs" :key="tab.id" :disabled="enc.reserveIdFor(combatant) === tab.id" @click="enc.moveNpcToReserve(combatant, tab.id); closeReserves(); close()">{{ tab.name }}</RowActionItem>
        </template>
      </RowActionSubmenu>
      <RowActionItem
        v-if="canRerollHp"
        :icon="Dices"
        @click="enc.rollNpcHpFromFormula(combatant); close()"
      >Перебросить HP</RowActionItem>
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
    </template>
  </RowActionMenu>
  <NpcImpactHistory v-if="historyOpen" :uid="combatant.uid" @close="historyOpen = false" />
</template>

<script setup>
import { computed, defineAsyncComponent, inject, nextTick, ref, shallowRef } from 'vue'
import { Activity, Archive, BookOpen, Copy, Dices, History } from '@lucide/vue'
import EncounterInitiativeMenu from './EncounterInitiativeMenu.vue'
import CharacterMenuActions from '@/features/character-editor/components/CharacterMenuActions.vue'
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
const emit = defineEmits(['edit-states', 'edit-note', 'view-participant'])

const enc = inject('encounter')

const isNpc = computed(() => props.combatant.type === 'npc')
const canOpenCard = computed(() => isNpc.value && props.combatant.itemId != null)
const canOpenSheet = computed(() => props.section === 'combat' && props.combatant.type === 'player' && !!enc.findParticipant(props.combatant.charId))
const canReserve = computed(() => props.combatant.position === 'combat')
const canRerollHp = computed(() =>
  isNpc.value && props.combatant.position === 'reserve' && !!enc.npcHpFormula(props.combatant)
)
const canRevive = computed(() => props.combatant.position === 'dead' && enc.canEditPlayerHp())

const cloneCount = ref(1)
const menuAnchor = shallowRef(null)
const menuRef = ref(null)

function openDetails(close) {
  close()
  if (canOpenCard.value) enc.openNpcDetail(props.combatant)
  else emit('view-participant', props.combatant.charId)
}

function cloneNpc(closeSubmenu, closeMenu) {
  enc.cloneNpc(props.combatant, cloneCount.value)
  closeSubmenu()
  closeMenu()
}

async function toggle(anchor) {
  menuAnchor.value = anchor
  await nextTick()
  menuRef.value?.toggle()
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
