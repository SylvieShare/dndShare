<template>
  <ItemUsePanel v-if="transfer?.selected" :title="transfer.active ? `+${transfer.value} к КД` : 'Перенос в защиту приостановлен'"
    :subtitle="transfer.active ? `Бонус оружия к атаке и урону: +${transfer.weaponBonus}. Пока держите оружие.` : 'Бонус не действует: предмет должен быть активен и экипирован.'">
    <template #icon><ShieldCheck :size="24" /></template>
    <template v-if="charCtx.ownerMode" #actions><ActionButton variant="quiet" @click="setAmount(0)"><RotateCcw :size="14" /> Сбросить перенос</ActionButton></template>
  </ItemUsePanel>
</template>
<script setup>
import { inject, toRef } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { ShieldCheck, RotateCcw } from '@lucide/vue'
import ItemUsePanel from './ItemUsePanel.vue'
import { useWeaponBonusTransfer } from '../composables/useWeaponBonusTransfer'
const props = defineProps({ uid: { type: String, required: true } })
const charCtx = inject('charCtx', {})
const { transfer, setAmount } = useWeaponBonusTransfer(charCtx, toRef(props, 'uid'))
</script>
