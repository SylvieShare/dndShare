<template>
  <div v-if="transfer?.active" class="bonus-transfer-selector">
    <FormField :label="transfer.title" :title="transfer.condition || 'Каждый пункт КД уменьшает магический бонус атаки и урона на 1.'">
      <WeaponResourceAmount :label="transfer.title" unit="к КД" :units="{ max: transfer.max, value: transfer.value, available: transfer.max }" :disabled="disabled" @change="$emit('change', $event)" />
    </FormField>
    <small>+{{ transfer.value }} к КД · +{{ transfer.weaponBonus }} к атаке и урону</small>
  </div>
</template>
<script setup>
import { FormField } from '@sylvieshare/share-ui'
import WeaponResourceAmount from './WeaponResourceAmount.vue'
defineProps({ transfer: { type: Object, required: true }, disabled: Boolean })
defineEmits(['change'])
</script>
<style scoped>
.bonus-transfer-selector { display: grid; gap: 5px; }
.bonus-transfer-selector small { color: var(--text-2); font-size: 12px; }
</style>
