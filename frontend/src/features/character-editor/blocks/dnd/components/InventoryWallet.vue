<template>
  <div class="inventory-wallet">
    <BlockMoney inline :block="walletBlock" :value="charCtx.values?.[wallet.value_id]"
      @update:value="(id, value) => charCtx.updateValues?.({ [id]: value })" />
  </div>
</template>
<script setup>
import { computed, inject } from 'vue'
import BlockMoney from '@/features/character-editor/blocks/generic/BlockMoney.vue'
const props = defineProps({ wallet: { type: Object, required: true } })
const charCtx = inject('charCtx', { ownerMode: false, values: {} })
const walletBlock = computed(() => ({
  id: props.wallet.value_id,
  content: { suggest_type_id: props.wallet.suggest_type_id },
}))
</script>
<style scoped>
.inventory-wallet { align-self: flex-end; max-width: 100%; min-width: 0; }
</style>
