<template>
  <div class="ability-action-fields">
    <FormField label="Открыть позже получения способности" title="По умолчанию правило доступно сразу вместе со способностью."><ToggleSwitch :model-value="later" aria-label="Открыть позже получения способности" @update:model-value="setLater" /></FormField>
    <FormField v-if="later" label="Доступно с уровня" vertical title="Уровень связанного класса, а без привязки — персонажа."><FormTextInput v-model:value="data.level" type="number" :min="base" max="20" aria-label="Доступно с уровня" /></FormField>
  </div>
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import { FormField, FormTextInput, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
const props = defineProps({ data: Object })
const editor = inject(itemFieldEditorKey, {})
const base = computed(() => Math.max(1, Number(editor.itemData?.level) || 1))
const later = ref(Number(props.data.level) > base.value)
function setLater(value) { later.value = value; if (value) props.data.level = Math.min(20, base.value + 1); else delete props.data.level }
</script>
