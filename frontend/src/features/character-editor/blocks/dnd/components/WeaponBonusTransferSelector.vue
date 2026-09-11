<template>
  <div v-if="transfer?.active" class="bonus-transfer-selector">
    <FormField :label="transfer.title" :title="transfer.condition || 'Каждый пункт КД уменьшает магический бонус атаки и урона на 1.'">
      <WeaponResourceAmount :label="transfer.title" unit="к КД" :units="{ max: transfer.max, value: transfer.value, available: transfer.max }" :disabled="!charCtx.ownerMode" @change="setAmount" />
    </FormField>
    <small>+{{ transfer.value }} к КД · +{{ transfer.weaponBonus }} к атаке и урону</small>
  </div>
</template>
<script setup>
import { inject, toRef } from 'vue'
import { FormField } from '@sylvieshare/share-ui'
import WeaponResourceAmount from './WeaponResourceAmount.vue'
import { useWeaponBonusTransfer } from '../composables/useWeaponBonusTransfer'
const props = defineProps({ uid: { type: String, required: true } })
const charCtx = inject('charCtx', {})
const { transfer, setAmount } = useWeaponBonusTransfer(charCtx, toRef(props, 'uid'))
</script>
<style scoped>
.bonus-transfer-selector { display: grid; gap: 5px; }
.bonus-transfer-selector small { color: var(--text-2); font-size: 12px; }
</style>
