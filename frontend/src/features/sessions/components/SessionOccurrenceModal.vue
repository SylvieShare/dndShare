<template>
  <AppModalFrame :title="occurrence.id ? 'Редактировать сессию' : 'Новая сессия кампании'" @close="!busy && $emit('close')">
    <div class="occurrence-form">
      <FormField label="Номер" vertical>
        <FormTextInput v-model:value="draft.number" type="number" min="1" max="1000000" step="1" :disabled="busy" aria-label="Номер сессии" />
      </FormField>
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="draft.name" :maxlength="160" :disabled="busy" placeholder="Например, Тайна старой крепости" aria-label="Название сессии" autofocus />
      </FormField>
      <FormField label="Дата игры" vertical>
        <DatePicker v-model="draft.date" locale="ru-RU" :disabled="busy" placeholder="Выберите дату" aria-label="Дата сессии"
          previous-label="Предыдущий месяц" next-label="Следующий месяц" month-label="Месяц" year-label="Год" today-label="Сегодня" />
      </FormField>
      <p class="occurrence-form__hint">У этой сессии будет свой раздел дневника. Дата и название обновляются вместе с ней.</p>
      <p v-if="error" role="alert" class="occurrence-form__error">{{ error }}</p>
    </div>
    <template #footer>
      <FormActionButtons :loading="busy" :disabled="busy" :can-submit="valid" :submit-text="occurrence.id ? 'Сохранить' : 'Создать'"
        @submit="$emit('save', draft)" @cancel="$emit('close')" />
    </template>
  </AppModalFrame>
</template>
<script setup>
import { computed, reactive } from 'vue'
import { AppModalFrame, DatePicker, FormActionButtons, FormField, FormTextInput } from '@sylvieshare/share-ui'
const props = defineProps({ occurrence: { type: Object, required: true }, busy: Boolean, error: String })
defineEmits(['save', 'close'])
const draft = reactive({ ...props.occurrence })
const valid = computed(() => draft.name.trim() && draft.date && Number.isInteger(Number(draft.number)) && Number(draft.number) > 0 && Number(draft.number) <= 1000000)
</script>
<style scoped>
.occurrence-form { display: flex; flex-direction: column; gap: 18px; }
.occurrence-form__hint { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.6; }
.occurrence-form__error { margin: 0; color: var(--danger); font-size: 13px; }
</style>
