<template>
  <RowActionSubmenu label="Отношение">
    <template #trigger="{ open }"><RowActionItem :icon="Tag" submenu :submenu-open="open">Отношение<template #suffix>{{ SIDE_LABEL[combatant.side] || 'Без тега' }}</template></RowActionItem></template>
    <template #default="{ close }">
      <RowActionItem v-for="option in SIDE_OPTIONS" :key="option.value" :icon="combatant.side === option.value ? Check : Tag" @click="enc.setSide(combatant, option.value); close()">{{ option.label }}</RowActionItem>
      <RowActionItem v-if="SIDE_LABEL[combatant.side]" :icon="X" @click="enc.setSide(combatant, null); close()">Убрать тег</RowActionItem>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { inject } from 'vue'
import { Check, Tag, X } from '@lucide/vue'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { SIDE_LABEL, SIDE_OPTIONS } from '../lib/encounterHelpers'
defineProps({ combatant: { type: Object, required: true } })
const enc = inject('encounter', null) || inject('applicationEncounter', null)
</script>
