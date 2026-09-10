<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fields.filter(f => f.key === 'text')" :data="data" @update:data="v => Object.assign(data, v)" />
    <div v-for="(row, index) in data.min_stats || []" :key="index" class="ability-condition-fields">
      <div class="ability-row-heading"><strong>Минимальная характеристика</strong><RemoveButton icon="trash" label="Удалить требование" @click="pending = index" /></div>
      <AbilityRuleFields :fields="fields.find(f => f.key === 'min_stats')?.fields || []" :data="row" @update:data="v => Object.assign(row, v)" />
    </div>
    <AddButton label="Добавить минимум характеристики" @click="data.min_stats = [...(data.min_stats || []), { value: 13 }]" />
    <ConfirmDialog v-if="pending != null" title="Удалить требование?" message="Характеристика больше не будет ограничивать получение способности." :z-index="(editor.zIndex || 4500) + 300" @confirm="remove" @close="pending = null" @cancel="pending = null" />
  </div>
</template>
<script setup>
import { inject, ref } from 'vue'
import { AddButton, ConfirmDialog, RemoveButton } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import AbilityRuleFields from './AbilityRuleFields.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {}), pending = ref(null)
function remove() { props.data.min_stats.splice(pending.value, 1); pending.value = null }
</script>
