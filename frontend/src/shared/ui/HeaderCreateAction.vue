<template>
  <ActionButton variant="primary" :aria-label="label" @click="emit('click',$event)">
    <template #icon><Plus :size="18" aria-hidden="true" /></template>
    <span class="header-create-full">{{ label }}</span>
    <span class="header-create-short">{{ shortLabel }}</span>
  </ActionButton>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Plus } from '@lucide/vue'
defineProps({ label:{type:String,required:true}, shortLabel:{type:String,default:'Создать'} })
const emit=defineEmits(['click'])
</script>
<style scoped>
.header-create-short {display:none}
@media (--ui-phone) { .header-create-full {display:none}.header-create-short {display:inline} }
</style>
