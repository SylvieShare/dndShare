<template>
  <template v-if="canAttack">
    <RowActionSubmenu v-for="scope in ['attack', 'damage']" :key="scope" :min-width="280">
      <template #trigger="{ open }">
        <RowActionItem :action="scope" submenu :submenu-open="open">{{ scope === 'attack' ? 'Бросить на атаку' : 'Бросить на урон' }}</RowActionItem>
      </template>
      <template #default="{ close }">
        <WeaponRollSettings v-bind="$attrs" :scope="scope"
          @attack="options => { close(); emit('attack', options) }"
          @roll="options => { close(); emit('roll', options) }"
          @roll-step="step => { close(); emit('roll-step', step) }" />
      </template>
    </RowActionSubmenu>
  </template>
  <WeaponRollSettings v-else scope="damage" v-bind="$attrs" @roll="emit('roll', $event)" @roll-step="emit('roll-step', $event)" />
</template>
<script setup>
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import WeaponRollSettings from './WeaponRollSettings.vue'
defineOptions({ inheritAttrs: false })
defineProps({ canAttack: Boolean })
const emit = defineEmits(['roll', 'attack', 'roll-step'])
</script>
