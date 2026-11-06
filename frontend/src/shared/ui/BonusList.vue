<template>
  <div v-for="(bonus, i) in rows" :key="i" class="bl-row">
    <template v-if="bonus.readonly">
      <div class="bl-readonly-name"><span>{{ bonus.name || bonus.title || 'Бонус' }}</span><small>{{ bonus.source_label ? `Источник: ${bonus.source_label}` : 'Источник: способности' }}</small></div>
      <strong class="bl-readonly-value">{{ Number(bonus.value) >= 0 ? '+' : '' }}{{ bonus.value }}</strong>
    </template>
    <template v-else>
      <FormTextInput class="bl-name" :value="bonus.name || bonus.title" placeholder="Название" @update:value="v => set(i, 'name', v)" />
      <FormNumberInput live :value="bonus.value" @change="v => set(i, 'value', v)" />
      <RemoveButton icon="trash" label="Удалить бонус" @click="remove(i)" />
    </template>
  </div>
  <AddButton v-if="allowAdd" block @click="add">Добавить бонус</AddButton>
</template>

<script setup>
import { computed } from 'vue'
import { AddButton } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { RemoveButton } from '@sylvieshare/share-ui'

const props = defineProps({
  bonuses: { type: Array, default: () => [] },
  allowAdd: { type: Boolean, default: true },
})
const rows = computed(() => props.bonuses.map(bonus =>
  bonus != null && typeof bonus === 'object' ? bonus : { value: bonus }
))
const emit = defineEmits(['update:bonuses'])

function set(i, field, v) {
  const row = rows.value[i]
  const key = field === 'name' && !('name' in row) && 'title' in row ? 'title' : field
  const updated = props.bonuses.map((b, idx) => idx === i ? { ...row, [key]: v } : b)
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
.bl-readonly-name { flex: 1; min-width: 0; display: flex; flex-direction: column; color: var(--text-1); font-size: 13px; overflow-wrap: anywhere; }
.bl-readonly-name small { color: var(--text-muted); font-size: 12px; }
.bl-readonly-value { color: var(--text-1); font-variant-numeric: tabular-nums; }
</style>
