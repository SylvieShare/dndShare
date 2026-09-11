<template>
  <FormField label="Когда действует свойство" title="Условие этой зависимости. Остальные свойства предмета сохраняют свои условия, требование настройки остаётся общим." vertical>
    <FormSelect :value="data.activation || ''" aria-label="Когда действует свойство" @update:value="value => { if (value) data.activation = value; else delete data.activation }">
      <option value="">Как у предмета</option><option value="carried">Пока предмет при персонаже</option><option value="equipped">Когда предмет экипирован</option>
    </FormSelect>
  </FormField>
</template>
<script setup>
import { FormField, FormSelect } from '@sylvieshare/share-ui'
defineProps({ data: Object })
</script>
