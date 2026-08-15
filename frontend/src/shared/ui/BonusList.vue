<template>
  <div v-for="(bonus, i) in bonuses" :key="i" class="bl-row">
    <FormTextInput class="bl-name" :value="bonus.name" placeholder="Название" @update:value="v => set(i, 'name', v)" />
    <FormNumberInput :value="bonus.value" @change="v => set(i, 'value', v)" />
    <RemoveButton label="Удалить бонус" @click="remove(i)" />
  </div>
  <AddButton block @click="add">Добавить бонус</AddButton>
</template>

<script setup>
import { AddButton } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { RemoveButton } from '@sylvieshare/share-ui'

const props = defineProps({ bonuses: { type: Array, default: () => [] } })
const emit = defineEmits(['update:bonuses'])

function set(i, field, v) {
  const updated = props.bonuses.map((b, idx) =>
    idx === i ? { ...b, [field]: field === 'value' ? (parseInt(v) || 0) : v } : b
  )
  emit('update:bonuses', updated)
}
function remove(i) {
  emit('update:bonuses', props.bonuses.filter((_, idx) => idx !== i))
}
function add() {
  emit('update:bonuses', [...props.bonuses, { name: '', value: 0 }])
}
</script>

<style scoped>
.bl-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bl-name {
  flex: 1;
  min-width: 0;
}
</style>
