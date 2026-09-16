<template>
  <RowActionSubmenu label="Инициатива" :min-width="230">
    <template #trigger="{ open }"><RowActionItem :icon="Dices" submenu :submenu-open="open">Инициатива<template #suffix>{{ combatant.initiative ?? '—' }}</template></RowActionItem></template>
    <template #default="{ close }">
      <FormField label="Инициатива" vertical>
        <FormNumberInput :value="combatant.initiative" @change="encounter.setInitiative(combatant, $event)" />
      </FormField>
      <RowActionItem :icon="Dices" @click="encounter.rollCombatantInitiative(combatant); close()">Бросить инициативу</RowActionItem>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { Dices } from '@lucide/vue'
import { FormField, FormNumberInput, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
defineProps({ combatant: { type: Object, required: true }, encounter: { type: Object, required: true } })
</script>
