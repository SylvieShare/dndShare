<template>
  <RowActionSubmenu :label="enterCombat ? 'Отправить в бой' : 'Инициатива'" :min-width="230">
    <template #trigger="{ open }"><RowActionItem :icon="enterCombat ? Swords : Dices" submenu :submenu-open="open">{{ enterCombat ? 'Отправить в бой' : 'Инициатива' }}<template #suffix>{{ combatant.initiative ?? '—' }}</template></RowActionItem></template>
    <template #default="{ close }">
      <FormField label="Инициатива" vertical>
        <FormNumberInput :placeholder="enterCombat ? 'Авто' : '—'" :value="combatant.initiative" @change="encounter.setInitiative(combatant, $event)" />
      </FormField>
      <RowActionItem v-if="enterCombat" :icon="Swords" @click="encounter.sendCombatantsTo([combatant], 'combat'); close(); $emit('joined')">В бой</RowActionItem>
      <RowActionItem v-else :icon="Dices" @click="encounter.rollCombatantInitiative(combatant); close()">Бросить инициативу</RowActionItem>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { Dices, Swords } from '@lucide/vue'
import { FormField, FormNumberInput, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
defineEmits(['joined'])
defineProps({ enterCombat: Boolean, combatant: { type: Object, required: true }, encounter: { type: Object, required: true } })
</script>
