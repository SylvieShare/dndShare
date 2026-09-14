<template>
  <AppModalFrame :title="`Длительность: ${status.title}`" :z-index="3500" @close="$emit('close')">
    <form id="status-duration-form" class="status-duration-fields" @submit.prevent="save">
      <FormField label="Когда заканчивается" vertical title="Длительность только этого экземпляра эффекта. Изменение не затрагивает справочник или другие эффекты.">
        <FormSelect v-model:value="draft.kind" aria-label="Когда заканчивается">
          <option v-for="option in STATUS_DURATION_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </FormSelect>
      </FormField>
      <FormField v-if="isTimedStatusDuration(draft.kind)" label="Количество" vertical title="Срок действия эффекта. Отсчёт времени и снятие пока отмечаются вручную.">
        <FormTextInput v-model:value="draft.value" type="number" min="1" step="1" aria-label="Количество" />
      </FormField>
      <FormField v-if="draft.kind === 'custom'" label="Условие окончания" vertical title="Например: до конца следующего хода или пока сохраняется концентрация.">
        <FormTextInput v-model:value="draft.text" maxlength="200" aria-label="Условие окончания" placeholder="До конца следующего хода" />
      </FormField>
      <span v-if="error" role="alert" class="status-duration-error">{{ error }}</span>
    </form>
    <template #footer><ActionButton type="submit" form="status-duration-form" :disabled="!!error">Сохранить</ActionButton></template>
  </AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ActionButton, AppModalFrame, FormField, FormSelect, FormTextInput } from '@sylvieshare/share-ui'
import { STATUS_DURATION_OPTIONS, cleanStatusDuration, copyStatusDuration, isTimedStatusDuration, statusDurationError } from '@/shared/lib/statusDuration'

const props = defineProps({ status: { type: Object, required: true } })
const emit = defineEmits(['close', 'save'])
const draft = ref({ value: 1, text: '', ...copyStatusDuration(props.status.duration) })
const error = computed(() => statusDurationError(draft.value))
function save() {
  if (!error.value) emit('save', cleanStatusDuration(draft.value))
}
</script>

<style scoped>
.status-duration-fields { display: grid; gap: 14px; }
.status-duration-error { color: var(--danger); font-size: 12px; }
</style>
