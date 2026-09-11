<template>
  <div class="ability-action-fields">
    <FormField label="Название в меню атаки" title="Рядом будут ячейки выбора количества. Они не расходуют ресурс." vertical>
      <FormTextInput v-model:value="data.title" placeholder="Перенести в защиту" />
    </FormField>
    <FormField label="Когда можно переносить" title="Подсказка игроку при выборе. Начало и конец хода не отслеживаются автоматически." vertical>
      <FormTextInput v-model:value="data.condition" placeholder="Например, при первой атаке в своём ходу" />
    </FormField>
    <BaseTile>До {{ maximum }} пунктов: каждый +1 к КД уменьшает бонус атаки и урона на 1. Максимум берётся из магического бонуса оружия. Сброс — кнопкой под оружием.</BaseTile>
  </div>
</template>
<script setup>
import { computed, inject, watchEffect, onScopeDispose } from 'vue'
import { BaseTile, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
defineProps({ data: { type: Object, required: true } })
const editor = inject(itemFieldEditorKey, {})
const maximum = computed(() => Number(editor.itemData?.weapon?.magic_bonus) || 0)
const validationKey = Symbol('weapon-bonus-transfer')
watchEffect(() => editor.setValidationError?.(validationKey, Number.isInteger(maximum.value) && maximum.value > 0 && maximum.value <= 3 ? '' : 'Перенос в защиту: задайте магический бонус оружия от 1 до 3 в свойствах предмета.'))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>
